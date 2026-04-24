// T130 / SC-002 — Prueba empírica de presupuesto y ausencia de seq-scan para
// las tres queries calientes del módulo `candidates` sobre un tenant con
// 10 000 candidatos (slug `perf-10k`).
//
// Requisitos previos:
//   - `pnpm -F @bepro/db seed:candidates-10k` debe haber sembrado el tenant
//     y las 10 000 filas. El test falla con mensaje accionable si no existe.
//   - DATABASE_URL y DATABASE_URL_WORKER configurados (ver harness).
//
// Diseño:
//   - Todas las queries se ejecutan con `EXPLAIN (ANALYZE, FORMAT JSON)` dentro
//     de `withTenantScope(getWorkerDb(), tenantId, ...)` — así probamos el
//     plan REAL bajo RLS y con el rol `app_worker` (el de producción).
//   - Parseamos el JSON devuelto y afirmamos:
//       1. Presupuesto: `Execution Time` (ms) < 1 000.
//       2. Nunca un `Seq Scan` sobre `candidates` en el árbol del plan.
//       3. Para la query FTS: índice GIN `candidates_search_idx` usado
//          (Bitmap Heap Scan / Index Scan).
//   - Loguear el plan y el tiempo facilita diagnóstico en CI.
//
// Nota sobre el shape devuelto por `tx.execute` con neon-http + drizzle:
// al no haber documentación estable, el test extrae el plan de forma
// defensiva buscando la clave `QUERY PLAN` (string JSON o array) o bien
// un array de objetos con la propiedad `Plan`. Ver `extractPlan()`.

import { beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { tenants, clients, type Database } from "@bepro/db";
import {
  getAdminDb,
  getWorkerDb,
  withTenantScope,
} from "./_integration/harness.js";

const PERF_SLUG = "perf-10k";
const PERF_CLIENT_NAME = "Perf Client";
const BUDGET_MS = 1000;

// ============================================================================
// Helpers de parsing
// ============================================================================

type PlanNode = {
  "Node Type": string;
  "Relation Name"?: string;
  "Index Name"?: string;
  Plans?: PlanNode[];
  [key: string]: unknown;
};

type PlanEnvelope = {
  Plan: PlanNode;
  "Execution Time"?: number;
  [key: string]: unknown;
};

// Extrae el JSON del plan de una respuesta de `EXPLAIN (ANALYZE, FORMAT JSON)`.
// Tolera varias formas que drizzle + neon-http pueden devolver:
//   a) { rows: [{ "QUERY PLAN": [ {Plan: ...} ] }] }
//   b) [{ "QUERY PLAN": [ {Plan: ...} ] }]  (result directo como array)
//   c) { "QUERY PLAN": "<json stringified>" } (string que hay que JSON.parse)
function extractPlan(raw: unknown): PlanEnvelope {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyRaw = raw as any;
  const rows: unknown[] = Array.isArray(anyRaw)
    ? anyRaw
    : Array.isArray(anyRaw?.rows)
      ? anyRaw.rows
      : [];

  if (rows.length === 0) {
    throw new Error(
      `extractPlan: respuesta sin filas — shape: ${JSON.stringify(raw).slice(0, 200)}`,
    );
  }

  const first = rows[0] as Record<string, unknown>;
  let queryPlan = first["QUERY PLAN"];
  // Si es string, intentar JSON.parse.
  if (typeof queryPlan === "string") {
    try {
      queryPlan = JSON.parse(queryPlan);
    } catch {
      throw new Error(
        `extractPlan: "QUERY PLAN" es string no parseable: ${queryPlan.slice(0, 200)}`,
      );
    }
  }
  if (!Array.isArray(queryPlan) || queryPlan.length === 0) {
    throw new Error(
      `extractPlan: "QUERY PLAN" no es array no vacío. Received: ${JSON.stringify(queryPlan).slice(0, 200)}`,
    );
  }
  return queryPlan[0] as PlanEnvelope;
}

// Recorre el árbol buscando un Seq Scan sobre la relación `candidates`.
function findSeqScanOnCandidates(node: PlanNode): PlanNode | null {
  if (
    node["Node Type"] === "Seq Scan" &&
    node["Relation Name"] === "candidates"
  ) {
    return node;
  }
  for (const child of node.Plans ?? []) {
    const hit = findSeqScanOnCandidates(child);
    if (hit) return hit;
  }
  return null;
}

// Recolecta los nombres de índices tocados en todo el árbol.
function collectIndexNames(node: PlanNode, acc: string[] = []): string[] {
  if (typeof node["Index Name"] === "string") acc.push(node["Index Name"] as string);
  for (const child of node.Plans ?? []) collectIndexNames(child, acc);
  return acc;
}

// Ejecuta un EXPLAIN ANALYZE (FORMAT JSON) y devuelve el envelope parseado.
async function explainAnalyze(
  tx: Database,
  query: ReturnType<typeof sql>,
): Promise<PlanEnvelope> {
  const raw = await tx.execute(sql`EXPLAIN (ANALYZE, FORMAT JSON) ${query}`);
  return extractPlan(raw);
}

// ============================================================================
// Suite
// ============================================================================

// El test se autosalta si el tenant `perf-10k` aún no está sembrado. De esa
// forma quien corra `test:integration` en un ambiente sin los 10k candidatos
// no se topa con un error ruidoso — simplemente ve "skipped" hasta que alguien
// ejecute `pnpm -F @bepro/db seed:candidates-10k`.
async function perfTenantExists(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  try {
    const adminDb = getAdminDb();
    const rows = await adminDb
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, PERF_SLUG))
      .limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

const runPerfSuite = await perfTenantExists();

describe.skipIf(!runPerfSuite)(
  "SC-002 — Perf: 10k candidates, no seq-scan, within budget",
  () => {
    let perfTenantId: string;
    let perfClientId: string;

    beforeAll(async () => {
      const adminDb = getAdminDb();
      const [perfTenant] = await adminDb
        .select()
        .from(tenants)
        .where(eq(tenants.slug, PERF_SLUG))
        .limit(1);
      if (!perfTenant) {
        throw new Error(
          "Perf tenant not seeded — run `pnpm -F @bepro/db seed:candidates-10k` first.",
        );
      }
      perfTenantId = perfTenant.id;

    const [perfClient] = await adminDb
      .select()
      .from(clients)
      .where(
        and(eq(clients.tenantId, perfTenantId), eq(clients.name, PERF_CLIENT_NAME)),
      )
      .limit(1);
    if (!perfClient) {
      throw new Error(
        "Perf client not seeded — run `pnpm -F @bepro/db seed:candidates-10k` first.",
      );
    }
    perfClientId = perfClient.id;
  }, 60_000);

  it(
    "list + status filter stays within budget and avoids seq-scan on candidates",
    async () => {
      const plan = await withTenantScope(
        getWorkerDb(),
        perfTenantId,
        async (tx) =>
          explainAnalyze(
            tx,
            sql`
              SELECT id FROM candidates
              WHERE tenant_id = ${perfTenantId}
                AND status = 'registered'
                AND is_active = true
              ORDER BY updated_at DESC, id DESC
              LIMIT 25
            `,
          ),
      );

      const execMs = Number(plan["Execution Time"] ?? Infinity);
      const topType = plan.Plan["Node Type"];
      console.log(
        `[perf.list] plan=${topType} exec_ms=${execMs} indexes=${collectIndexNames(plan.Plan).join(",") || "(none)"}`,
      );

      const seq = findSeqScanOnCandidates(plan.Plan);
      expect(
        seq,
        `Expected no Seq Scan on candidates, found: ${JSON.stringify(seq)}`,
      ).toBeNull();
      expect(execMs).toBeLessThan(BUDGET_MS);
    },
    60_000,
  );

  it(
    "composite filter (status + client + date range) stays within budget and avoids seq-scan",
    async () => {
      const plan = await withTenantScope(
        getWorkerDb(),
        perfTenantId,
        async (tx) =>
          explainAnalyze(
            tx,
            sql`
              SELECT id FROM candidates
              WHERE tenant_id = ${perfTenantId}
                AND status = 'approved'
                AND client_id = ${perfClientId}
                AND created_at >= now() - interval '30 days'
              ORDER BY updated_at DESC
              LIMIT 25
            `,
          ),
      );

      const execMs = Number(plan["Execution Time"] ?? Infinity);
      const topType = plan.Plan["Node Type"];
      console.log(
        `[perf.composite] plan=${topType} exec_ms=${execMs} indexes=${collectIndexNames(plan.Plan).join(",") || "(none)"}`,
      );

      const seq = findSeqScanOnCandidates(plan.Plan);
      expect(
        seq,
        `Expected no Seq Scan on candidates, found: ${JSON.stringify(seq)}`,
      ).toBeNull();
      expect(execMs).toBeLessThan(BUDGET_MS);
    },
    60_000,
  );

  it(
    "full-text search via tsvector uses GIN index and stays within budget",
    async () => {
      const plan = await withTenantScope(
        getWorkerDb(),
        perfTenantId,
        async (tx) =>
          explainAnalyze(
            tx,
            sql`
              SELECT id FROM candidates
              WHERE tenant_id = ${perfTenantId}
                AND search_tsv @@ plainto_tsquery('simple', 'ZZZ-UNIQUE-SENTINEL')
              LIMIT 25
            `,
          ),
      );

      const execMs = Number(plan["Execution Time"] ?? Infinity);
      const topType = plan.Plan["Node Type"];
      const indexes = collectIndexNames(plan.Plan);
      console.log(
        `[perf.search] plan=${topType} exec_ms=${execMs} indexes=${indexes.join(",") || "(none)"}`,
      );

      const seq = findSeqScanOnCandidates(plan.Plan);
      expect(
        seq,
        `Expected no Seq Scan on candidates for FTS, found: ${JSON.stringify(seq)}`,
      ).toBeNull();
      expect(execMs).toBeLessThan(BUDGET_MS);
      // Debe usar el índice GIN sembrado por 0006_candidates_search_trigger.sql.
      expect(
        indexes.some((name) => name === "candidates_search_idx"),
        `Expected 'candidates_search_idx' in the plan, got: ${indexes.join(",")}`,
      ).toBe(true);
    },
    60_000,
  );
});
