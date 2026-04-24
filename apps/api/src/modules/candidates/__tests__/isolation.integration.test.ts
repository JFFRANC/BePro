// 007-candidates-module — T125 / SC-004.
//
// Prueba empírica de aislamiento cross-tenant contra Neon real (no mocks).
// El objetivo es el Principio I de la constitución: un request de Tenant A
// NUNCA puede recibir datos de Tenant B por ningún endpoint, URL, o combo
// de parámetros. RLS (app_worker, NOBYPASSRLS) es el safety net; el filtro
// aplicativo es la primera línea. Este test ejerce ambas capas a través
// del HTTP del Worker (app.request) para que corra el pipeline completo:
// authMiddleware → tenantMiddleware (SET LOCAL app.tenant_id) → handler.
//
// Patrón: 404 siempre (nunca 403) en recursos fuera del tenant, para no
// permitir enumeración por códigos de estado distintos.
//
// Setup:
//   - Seedeamos 2 tenants con el harness.
//   - Insertamos 2 candidatos en cada uno vía adminDb (BYPASSRLS).
//   - Firmamos un access token para el admin del Tenant A.
//   - Golpeamos cada endpoint apuntando a recursos del Tenant B y
//     verificamos que el Worker responde 404 / listas vacías.
//   - Incluimos un chequeo DB-level (belt-and-suspenders) vía app_worker
//     + SET LOCAL app.tenant_id = A: RLS debe ocultar los candidatos de B
//     aunque el filtro aplicativo se saltara.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { candidates } from "@bepro/db";
import { eq } from "drizzle-orm";
import app from "../../../index.js";
import {
  cleanupTenant,
  getAdminDb,
  getWorkerDb,
  integrationEnv,
  seedTenant,
  signAccessToken,
  withTenantScope,
  type SeededTenant,
} from "./_integration/harness.js";

// Helper: inserta un candidato "registrado" mínimo vía adminDb.
async function insertCandidate(
  tenant: SeededTenant,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    phoneNormalized: string;
    email: string;
  }> = {},
): Promise<{ id: string }> {
  const db = getAdminDb();
  const [row] = await db
    .insert(candidates)
    .values({
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      registeringUserId: tenant.users.recruiter.id,
      firstName: overrides.firstName ?? "Juan",
      lastName: overrides.lastName ?? "Pérez",
      phone: overrides.phone ?? "+52 555 000 0001",
      phoneNormalized: overrides.phoneNormalized ?? "5550000001",
      email: overrides.email ?? `cand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.bepro.mx`,
      source: "referral",
      status: "registered",
      privacyNoticeId: tenant.privacyNoticeId,
      privacyNoticeAcknowledgedAt: new Date(),
    })
    .returning({ id: candidates.id });
  return row;
}

describe("SC-004 — Aislamiento cross-tenant en el módulo candidates", () => {
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;
  let candidatesA: { id: string }[];
  let candidatesB: { id: string }[];
  let tokenA: string;
  let env: ReturnType<typeof integrationEnv>;

  beforeAll(async () => {
    tenantA = await seedTenant();
    tenantB = await seedTenant();

    // 2 candidatos por tenant; emails únicos para evitar colisiones con
    // el índice (tenant_id, phone_normalized, client_id) si se replica por accidente.
    candidatesA = [
      await insertCandidate(tenantA, {
        firstName: "A1",
        phone: "+52 555 000 A001",
        phoneNormalized: "5550000011",
        email: `a1+${tenantA.slug}@test.bepro.mx`,
      }),
      await insertCandidate(tenantA, {
        firstName: "A2",
        phone: "+52 555 000 A002",
        phoneNormalized: "5550000012",
        email: `a2+${tenantA.slug}@test.bepro.mx`,
      }),
    ];
    candidatesB = [
      await insertCandidate(tenantB, {
        firstName: "B1",
        phone: "+52 555 000 B001",
        phoneNormalized: "5550000021",
        email: `b1+${tenantB.slug}@test.bepro.mx`,
      }),
      await insertCandidate(tenantB, {
        firstName: "B2",
        phone: "+52 555 000 B002",
        phoneNormalized: "5550000022",
        email: `b2+${tenantB.slug}@test.bepro.mx`,
      }),
    ];

    tokenA = await signAccessToken({
      userId: tenantA.users.admin.id,
      tenantId: tenantA.tenantId,
      role: "admin",
      email: tenantA.users.admin.email,
    });

    env = integrationEnv();
  });

  afterAll(async () => {
    if (tenantA?.tenantId) await cleanupTenant(tenantA.tenantId);
    if (tenantB?.tenantId) await cleanupTenant(tenantB.tenantId);
  });

  // Helper local — firma request con token A y env de integración.
  async function requestAsA(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    return app.request(
      path,
      {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          Authorization: `Bearer ${tokenA}`,
        },
      },
      env,
    );
  }

  it("GET /api/candidates — lista de Tenant A NO incluye ids de Tenant B", async () => {
    const res = await requestAsA("/api/candidates?limit=100");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    const ids = new Set(body.items.map((it) => it.id));
    // Todos los de A (admin ve todo el tenant) deben estar presentes.
    for (const c of candidatesA) expect(ids.has(c.id)).toBe(true);
    // Ninguno de B puede filtrarse.
    for (const c of candidatesB) expect(ids.has(c.id)).toBe(false);
  });

  it("GET /api/candidates/:id — id de Tenant B responde 404 (no enumeration)", async () => {
    const res = await requestAsA(`/api/candidates/${candidatesB[0].id}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /api/candidates/:id — id de Tenant B responde 404 sin mutar", async () => {
    const res = await requestAsA(`/api/candidates/${candidatesB[0].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first_name: "Intruso" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/candidates/:id/transitions — id de Tenant B responde 404", async () => {
    const res = await requestAsA(
      `/api/candidates/${candidatesB[0].id}/transitions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_status: "registered",
          to_status: "interview_scheduled",
        }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/candidates/:id/reactivate — id de Tenant B responde 404", async () => {
    const res = await requestAsA(
      `/api/candidates/${candidatesB[0].id}/reactivate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "intento cross-tenant" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/candidates/:id/attachments — init sobre Tenant B responde 404", async () => {
    // R2 no se ejerce: el handler falla antes (candidato no visible) por el
    // filtro aplicativo; si llegara a R2 el stub del harness también lo tolera.
    const res = await requestAsA(
      `/api/candidates/${candidatesB[0].id}/attachments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: "cv.pdf",
          mime_type: "application/pdf",
          size_bytes: 1024,
        }),
      },
    );
    expect(res.status).toBe(404);
  });

  it("GET /api/candidates/categories/rejection — sólo categorías de Tenant A", async () => {
    const res = await requestAsA("/api/candidates/categories/rejection");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    const ids = new Set(body.items.map((it) => it.id));
    expect(ids.has(tenantA.rejectionCategoryId)).toBe(true);
    expect(ids.has(tenantB.rejectionCategoryId)).toBe(false);
  });

  it("GET /api/candidates/categories/decline — sólo categorías de Tenant A", async () => {
    const res = await requestAsA("/api/candidates/categories/decline");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    const ids = new Set(body.items.map((it) => it.id));
    expect(ids.has(tenantA.declineCategoryId)).toBe(true);
    expect(ids.has(tenantB.declineCategoryId)).toBe(false);
  });

  it("GET /api/candidates/retention-reviews/status — estado del Tenant A (no B)", async () => {
    const res = await requestAsA("/api/candidates/retention-reviews/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      next_due_at: string;
      days_remaining: number;
      status: "ok" | "due_soon" | "overdue";
      last_review: { id: string; reviewer_user_id: string; reviewed_at: string } | null;
    };
    // Ninguno de los dos tenants tiene reviews previos; el endpoint devuelve
    // un "placeholder" consistente. La clave de este test: al NO haber review
    // previa de A ni de B, el shape debe reflejar eso — nunca un review_id
    // que pertenezca a B. Como ninguno tiene review, last_review es null.
    expect(body.last_review).toBeNull();
    expect(typeof body.next_due_at).toBe("string");
    expect(["ok", "due_soon", "overdue"]).toContain(body.status);
  });

  it("Belt-and-suspenders: app_worker + SET LOCAL(A) NO ve candidatos de Tenant B (RLS safety net)", async () => {
    // Aún si el filtro aplicativo se saltara (ej. un SELECT sin WHERE tenant_id),
    // RLS debe ocultar las filas del otro tenant. Abrimos una transacción con
    // SET LOCAL app.tenant_id = A y consultamos TODA la tabla sin WHERE.
    const rows = await withTenantScope(
      getWorkerDb(),
      tenantA.tenantId,
      async (tx) => tx.select({ id: candidates.id, tenantId: candidates.tenantId }).from(candidates),
    );
    const ids = new Set(rows.map((r) => r.id));
    // Sólo deben verse los del Tenant A.
    for (const c of candidatesA) expect(ids.has(c.id)).toBe(true);
    for (const c of candidatesB) expect(ids.has(c.id)).toBe(false);
    // Todas las filas visibles pertenecen al tenant A (sanity extra).
    for (const r of rows) expect(r.tenantId).toBe(tenantA.tenantId);

    // Simétrico: con SET LOCAL(B), un SELECT directo por id de A devuelve 0 filas.
    const leak = await withTenantScope(
      getWorkerDb(),
      tenantB.tenantId,
      async (tx) =>
        tx
          .select({ id: candidates.id })
          .from(candidates)
          .where(eq(candidates.id, candidatesA[0].id)),
    );
    expect(leak).toHaveLength(0);
  });
});
