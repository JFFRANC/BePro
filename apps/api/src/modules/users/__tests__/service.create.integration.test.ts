// 010-user-client-assignment / US1 — integration test contra Neon real.
//
// Objetivos clave:
//   - Verifica el dual-write atómico (users + client_assignments + audit_events).
//   - Verifica el rollback completo si el client validation falla.
//   - Verifica que un clientId de OTRO tenant es rechazado (RLS + filtro
//     aplicativo) sin enumeration leak.
//   - Verifica que admin/manager con stray clientId son tolerados (no-op).
//
// Setup: dos tenants seedeados con el harness compartido. El admin del
// Tenant A es quien hace los POST /api/users.
//
// El test golpea HTTP (app.request) para ejercer el pipeline completo:
// authMiddleware → tenantMiddleware (SET LOCAL app.tenant_id) → handler.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { users, clientAssignments, auditEvents, clients } from "@bepro/db";
import app from "../../../index.js";
import {
  cleanupTenant,
  getAdminDb,
  integrationEnv,
  seedTenant,
  signAccessToken,
  type SeededTenant,
} from "../../candidates/__tests__/_integration/harness.js";

describe("POST /api/users — 010 client assignment (US1)", () => {
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;
  let tokenA: string;
  let env: ReturnType<typeof integrationEnv>;

  beforeAll(async () => {
    tenantA = await seedTenant();
    tenantB = await seedTenant();
    tokenA = await signAccessToken({
      userId: tenantA.users.admin.id,
      tenantId: tenantA.tenantId,
      role: "admin",
      email: tenantA.users.admin.email,
    });
    env = integrationEnv();
  });

  afterAll(async () => {
    await cleanupTenant(tenantA.tenantId);
    await cleanupTenant(tenantB.tenantId);
  });

  // Helper: cuenta filas de users + client_assignments + audit_events para un
  // email dado, scoped al tenantA. Útil para probar atomicidad/rollback.
  async function snapshot(email: string) {
    const db = getAdminDb();
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantA.tenantId), eq(users.email, email)));
    const userRow = u ?? null;
    const assignmentCount = userRow
      ? (
          await db
            .select({ id: clientAssignments.id })
            .from(clientAssignments)
            .where(eq(clientAssignments.userId, userRow.id))
        ).length
      : 0;
    const auditCount = userRow
      ? (
          await db
            .select({ id: auditEvents.id })
            .from(auditEvents)
            .where(
              and(
                eq(auditEvents.targetType, "user"),
                eq(auditEvents.targetId, userRow.id),
              ),
            )
        ).length
      : 0;
    return { userRow, assignmentCount, auditCount };
  }

  it("creates user + client_assignments + audit row atomically (recruiter + valid client)", async () => {
    const email = `rec-happy-${Date.now()}@test.bepro.mx`;
    const res = await app.request(
      "/api/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          email,
          password: "Sup3rSecret123",
          firstName: "Rec",
          lastName: "Happy",
          role: "recruiter",
          isFreelancer: false,
          clientId: tenantA.clientId,
        }),
      },
      env,
    );
    expect(res.status).toBe(201);

    const snap = await snapshot(email);
    expect(snap.userRow).not.toBeNull();
    expect(snap.assignmentCount).toBe(1);
    expect(snap.auditCount).toBe(1);

    // accountExecutiveId siempre NULL en este flujo (Q3 del clarify).
    const db = getAdminDb();
    const [assignment] = await db
      .select({
        accountExecutiveId: clientAssignments.accountExecutiveId,
        clientId: clientAssignments.clientId,
        tenantId: clientAssignments.tenantId,
      })
      .from(clientAssignments)
      .where(eq(clientAssignments.userId, snap.userRow!.id));
    expect(assignment.accountExecutiveId).toBeNull();
    expect(assignment.clientId).toBe(tenantA.clientId);
    expect(assignment.tenantId).toBe(tenantA.tenantId);

    // El audit row debe llevar clientId en newValues (FR-006).
    const [audit] = await db
      .select({ newValues: auditEvents.newValues })
      .from(auditEvents)
      .where(eq(auditEvents.targetId, snap.userRow!.id));
    expect((audit.newValues as Record<string, unknown>).clientId).toBe(
      tenantA.clientId,
    );
  });

  it("creates user + client_assignments atomically (account_executive + valid client)", async () => {
    const email = `ae-happy-${Date.now()}@test.bepro.mx`;
    const res = await app.request(
      "/api/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          email,
          password: "Sup3rSecret123",
          firstName: "AE",
          lastName: "Happy",
          role: "account_executive",
          isFreelancer: false,
          clientId: tenantA.clientId,
        }),
      },
      env,
    );
    expect(res.status).toBe(201);

    const snap = await snapshot(email);
    expect(snap.userRow).not.toBeNull();
    expect(snap.assignmentCount).toBe(1);
  });

  it("rejects with 400 'cliente inactivo o inexistente' when clientId belongs to another tenant (RLS)", async () => {
    const email = `cross-tenant-${Date.now()}@test.bepro.mx`;
    const res = await app.request(
      "/api/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          email,
          password: "Sup3rSecret123",
          firstName: "Cross",
          lastName: "Tenant",
          role: "recruiter",
          isFreelancer: false,
          clientId: tenantB.clientId,
        }),
      },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("cliente inactivo o inexistente");

    // Atomicidad: el user NO debe haberse creado.
    const snap = await snapshot(email);
    expect(snap.userRow).toBeNull();
    expect(snap.assignmentCount).toBe(0);
    expect(snap.auditCount).toBe(0);
  });

  it("rejects with 400 when clientId points to an inactive client (and rolls back the user)", async () => {
    // Desactivamos el cliente del tenantA para esta prueba.
    const db = getAdminDb();
    await db
      .update(clients)
      .set({ isActive: false })
      .where(eq(clients.id, tenantA.clientId));

    const email = `inactive-client-${Date.now()}@test.bepro.mx`;
    try {
      const res = await app.request(
        "/api/users",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenA}`,
          },
          body: JSON.stringify({
            email,
            password: "Sup3rSecret123",
            firstName: "Inactive",
            lastName: "Client",
            role: "recruiter",
            isFreelancer: false,
            clientId: tenantA.clientId,
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("cliente inactivo o inexistente");

      const snap = await snapshot(email);
      expect(snap.userRow).toBeNull();
    } finally {
      await db
        .update(clients)
        .set({ isActive: true })
        .where(eq(clients.id, tenantA.clientId));
    }
  });

  it("rejects with 400 when clientId is a fabricated UUID that does not exist", async () => {
    const email = `fabricated-${Date.now()}@test.bepro.mx`;
    const res = await app.request(
      "/api/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          email,
          password: "Sup3rSecret123",
          firstName: "Fab",
          lastName: "Ricated",
          role: "recruiter",
          isFreelancer: false,
          clientId: "00000000-0000-0000-0000-000000000000",
        }),
      },
      env,
    );
    expect(res.status).toBe(400);

    const snap = await snapshot(email);
    expect(snap.userRow).toBeNull();
  });

  it("creates admin without writing a client_assignments row (defensive no-op even with stray clientId — US3)", async () => {
    const email = `admin-stray-${Date.now()}@test.bepro.mx`;
    const res = await app.request(
      "/api/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          email,
          password: "Sup3rSecret123",
          firstName: "Admin",
          lastName: "Stray",
          role: "admin",
          isFreelancer: false,
          // stray clientId — el server lo debe ignorar
          clientId: tenantA.clientId,
        }),
      },
      env,
    );
    expect(res.status).toBe(201);

    const snap = await snapshot(email);
    expect(snap.userRow).not.toBeNull();
    expect(snap.assignmentCount).toBe(0);

    // Audit no debe contener clientId para admin.
    const db = getAdminDb();
    const [audit] = await db
      .select({ newValues: auditEvents.newValues })
      .from(auditEvents)
      .where(eq(auditEvents.targetId, snap.userRow!.id));
    expect(
      (audit.newValues as Record<string, unknown>).clientId,
    ).toBeUndefined();
  });

  it("creates manager without writing a client_assignments row (defensive no-op even with stray clientId — US3)", async () => {
    const email = `manager-stray-${Date.now()}@test.bepro.mx`;
    const res = await app.request(
      "/api/users",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          email,
          password: "Sup3rSecret123",
          firstName: "Mgr",
          lastName: "Stray",
          role: "manager",
          isFreelancer: false,
          clientId: tenantA.clientId,
        }),
      },
      env,
    );
    expect(res.status).toBe(201);

    const snap = await snapshot(email);
    expect(snap.userRow).not.toBeNull();
    expect(snap.assignmentCount).toBe(0);
  });
});
