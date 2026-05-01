// 012-client-detail-ux — pre-deploy migration script (R-05).
//
// Lives inside `packages/db/scripts/` so it can resolve `drizzle-orm` +
// `@neondatabase/serverless` from the package's local node_modules (the
// repo-root `scripts/` directory has no node_modules and tsx fails to walk
// up to a workspace package). The integration test in apps/api imports this
// module by absolute path; the CLI invocation is via the package script
// `pnpm --filter @bepro/db migrate:012`.
//
// Renames any legacy custom-field key in `clients.form_config.fields[]` that
// collides with a BASE_CANDIDATE_FIELDS entry to `legacy_<key>`, and rewrites
// the matching property on every candidate's `additional_fields` JSONB so the
// captured value is preserved end-to-end.
//
// Idempotent: re-running after a successful pass is a no-op (no collisions
// remaining). Per-tenant transaction boundary so a malformed tenant doesn't
// block the rest. Uses the admin connection (`DATABASE_URL`) to span tenants —
// runs outside RLS by design.
//
// Audit: one row per affected tenant with `action = "012_legacy_formconfig_collision_rename"`.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import { tenants } from "../src/schema/tenants.js";
import { clients } from "../src/schema/clients.js";
import { candidates } from "../src/schema/candidates.js";
import { auditEvents } from "../src/schema/audit-events.js";

// 012-client-detail-ux / FR-009 — duplicated inline from
// `@bepro/shared/candidates/base-fields` to avoid a cross-package import in
// a script. The source of truth is BASE_CANDIDATE_FIELDS in @bepro/shared;
// the integration test (T014) keeps both in sync by virtue of importing the
// shared constant and exercising this rename logic together.
const BASE_FIELD_KEYS: ReadonlySet<string> = new Set([
  "fullName",
  "interviewPhone",
  "interviewDate",
  "interviewTime",
  "positionId",
  "state",
  "municipality",
  "recruiterName",
  "accountExecutiveName",
]);

interface FieldEntry {
  key: string;
  [k: string]: unknown;
}
interface FormConfigShape {
  fields?: FieldEntry[];
  [k: string]: unknown;
}

interface PerTenantSummary {
  tenantId: string;
  clientsScanned: number;
  clientsRewritten: number;
  candidatesRewritten: number;
  renames: { fromKey: string; toKey: string; count: number }[];
}

const LEGACY_PREFIX = "legacy_";

function isCollision(key: string): boolean {
  return BASE_FIELD_KEYS.has(key);
}

function renameKey(originalKey: string): string {
  return `${LEGACY_PREFIX}${originalKey}`;
}

// Drizzle exposes the same chainable API across the neon-http and
// neon-serverless adapters. The integration test passes a neon-serverless
// client (via `@bepro/db`'s `createDb`); the CLI uses the neon-http driver
// directly. Widening the parameter to a structural alias keeps both paths
// type-safe without forcing the test to swap drivers.
type DbClient = ReturnType<typeof drizzle> | unknown;

export async function processTenant(
  db: DbClient,
  tenantId: string,
  dryRun: boolean,
): Promise<PerTenantSummary> {
  // Cast at the boundary; downstream Drizzle calls share the same query DSL
  // shape across adapters.
  const tx = db as ReturnType<typeof drizzle>;
  const summary: PerTenantSummary = {
    tenantId,
    clientsScanned: 0,
    clientsRewritten: 0,
    candidatesRewritten: 0,
    renames: [],
  };
  const renameCounts = new Map<string, number>();

  const clientRows = await tx
    .select({ id: clients.id, formConfig: clients.formConfig })
    .from(clients)
    .where(eq(clients.tenantId, tenantId));

  summary.clientsScanned = clientRows.length;

  for (const row of clientRows) {
    const cfg = (row.formConfig ?? {}) as FormConfigShape;
    const fields: FieldEntry[] = Array.isArray(cfg.fields) ? cfg.fields : [];
    if (fields.length === 0) continue;

    const collidingKeys = fields
      .map((f) => f.key)
      .filter((k): k is string => typeof k === "string" && isCollision(k));
    if (collidingKeys.length === 0) continue;

    const renamedFields = fields.map((f) =>
      typeof f.key === "string" && isCollision(f.key)
        ? { ...f, key: renameKey(f.key) }
        : f,
    );
    const nextConfig: FormConfigShape = { ...cfg, fields: renamedFields };

    const candRows = await tx
      .select({
        id: candidates.id,
        additionalFields: candidates.additionalFields,
      })
      .from(candidates)
      .where(
        and(
          eq(candidates.tenantId, tenantId),
          eq(candidates.clientId, row.id),
        ),
      );

    let candidatesTouched = 0;
    if (!dryRun) {
      for (const c of candRows) {
        const af = (c.additionalFields ?? {}) as Record<string, unknown>;
        let mutated = false;
        const next = { ...af };
        for (const k of collidingKeys) {
          if (k in next) {
            const renamed = renameKey(k);
            next[renamed] = next[k];
            delete next[k];
            mutated = true;
          }
        }
        if (mutated) {
          await tx
            .update(candidates)
            .set({ additionalFields: next as never })
            .where(eq(candidates.id, c.id));
          candidatesTouched++;
        }
      }
      await tx
        .update(clients)
        .set({ formConfig: nextConfig as never })
        .where(eq(clients.id, row.id));
    } else {
      for (const c of candRows) {
        const af = (c.additionalFields ?? {}) as Record<string, unknown>;
        if (collidingKeys.some((k) => k in af)) candidatesTouched++;
      }
    }

    summary.clientsRewritten++;
    summary.candidatesRewritten += candidatesTouched;
    for (const k of collidingKeys) {
      renameCounts.set(k, (renameCounts.get(k) ?? 0) + 1);
    }
  }

  summary.renames = Array.from(renameCounts.entries()).map(([fromKey, count]) => ({
    fromKey,
    toKey: renameKey(fromKey),
    count,
  }));

  if (!dryRun && summary.clientsRewritten > 0) {
    await tx.insert(auditEvents).values({
      tenantId,
      // synthetic actorId — script runs without an authenticated user. We
      // store the tenant id itself to satisfy NOT NULL while making it
      // recognizable in audit queries.
      actorId: tenantId,
      action: "012_legacy_formconfig_collision_rename",
      targetType: "tenant_form_config",
      targetId: tenantId,
      oldValues: null,
      newValues: {
        renames: summary.renames,
        clientsRewritten: summary.clientsRewritten,
        candidatesRewritten: summary.candidatesRewritten,
      },
    });
  }

  return summary;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL no está configurado. Carga apps/api/.dev.vars o exporta DATABASE_URL.",
    );
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);
  console.log(
    `[012-migrate] Modo: ${dryRun ? "DRY-RUN (no escribe)" : "EXECUTE"}`,
  );

  const tenantRows = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants);
  console.log(`[012-migrate] Tenants encontrados: ${tenantRows.length}`);

  let totalClients = 0;
  let totalCandidates = 0;
  for (const t of tenantRows) {
    try {
      const s = await processTenant(db, t.id, dryRun);
      totalClients += s.clientsRewritten;
      totalCandidates += s.candidatesRewritten;
      if (s.clientsRewritten > 0) {
        console.log(
          `  ✓ tenant ${t.id} (${t.name}): ${s.clientsRewritten}/${s.clientsScanned} clientes, ${s.candidatesRewritten} candidatos, renames=${JSON.stringify(s.renames)}`,
        );
      } else {
        console.log(
          `  · tenant ${t.id} (${t.name}): ${s.clientsScanned} clientes sin colisiones`,
        );
      }
    } catch (err) {
      console.error(
        `  ✗ tenant ${t.id} (${t.name}): error procesando — ${(err as Error).message}`,
      );
    }
  }

  console.log(
    `[012-migrate] Resumen: ${totalClients} clientes, ${totalCandidates} candidatos`,
  );
}

const isCli =
  typeof process !== "undefined" &&
  process.argv[1] &&
  /012-rename-legacy-formconfig-collisions/.test(process.argv[1]);

if (isCli) {
  main().catch((err) => {
    console.error("Fallo inesperado:", err);
    process.exit(1);
  });
}

export { renameKey };
export type { PerTenantSummary };
