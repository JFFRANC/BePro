// 011-puestos-profile-docs / US1 — integration test contra Neon real (T019).
//
// Objetivos:
//   - RLS impide lecturas cross-tenant de puestos.
//   - Los campos de perfil persisten round-trip (insert + select).
//   - Audit `client_position.create` lleva el snapshot completo.
//   - Audit `client_position.update` lleva el diff.
//
// Skipped por defecto si DATABASE_URL_WORKER no está configurado (CI sin DB).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { clientPositions, auditEvents } from "@bepro/db";
import app from "../../../index.js";
import {
  cleanupTenant,
  getAdminDb,
  integrationEnv,
  seedTenant,
  signAccessToken,
  type SeededTenant,
} from "../../candidates/__tests__/_integration/harness.js";

const HAS_DB = !!process.env.DATABASE_URL_WORKER;

describe.skipIf(!HAS_DB)("011 — Position profile integration (real Neon)", () => {
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;
  let aeTokenA: string;
  let recruiterTokenB: string;
  let env: ReturnType<typeof integrationEnv>;

  beforeAll(async () => {
    tenantA = await seedTenant();
    tenantB = await seedTenant();
    aeTokenA = await signAccessToken({
      userId: tenantA.users.ae.id,
      tenantId: tenantA.tenantId,
      role: "account_executive",
      email: tenantA.users.ae.email,
    });
    recruiterTokenB = await signAccessToken({
      userId: tenantB.users.recruiter.id,
      tenantId: tenantB.tenantId,
      role: "recruiter",
      email: tenantB.users.recruiter.email,
    });
    env = integrationEnv();
  });

  afterAll(async () => {
    await cleanupTenant(tenantA.tenantId);
    await cleanupTenant(tenantB.tenantId);
  });

  it("AE crea puesto con perfil completo y persiste todos los campos (round-trip)", async () => {
    const res = await app.request(
      `/api/clients/${tenantA.clientId}/positions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aeTokenA}`,
        },
        body: JSON.stringify({
          name: "AYUDANTE GENERAL",
          vacancies: 80,
          ageMin: 18,
          ageMax: 48,
          gender: "indistinto",
          educationLevel: "primaria",
          salaryAmount: 1951.0,
          salaryCurrency: "MXN",
          paymentFrequency: "weekly",
          workDays: ["mon", "tue", "wed", "thu", "fri"],
          shift: "fixed",
          requiredDocuments: ["CURP"],
          faq: ["NO REINGRESOS"],
        }),
      },
      env,
    );
    expect(res.status).toBe(201);

    // Verificar persistencia en DB con admin client
    const adminDb = getAdminDb();
    const [row] = await adminDb
      .select()
      .from(clientPositions)
      .where(
        and(
          eq(clientPositions.tenantId, tenantA.tenantId),
          eq(clientPositions.name, "AYUDANTE GENERAL"),
        ),
      );
    expect(row).toBeDefined();
    expect(row.vacancies).toBe(80);
    expect(row.ageMin).toBe(18);
    expect(row.gender).toBe("indistinto");
    expect(row.workDays).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(row.faq).toEqual(["NO REINGRESOS"]);

    // Audit con snapshot completo
    const auditRows = await adminDb
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantA.tenantId),
          eq(auditEvents.targetType, "client_position"),
          eq(auditEvents.action, "create"),
          eq(auditEvents.targetId, row.id),
        ),
      );
    expect(auditRows.length).toBe(1);
    const newPayload = auditRows[0].newValues as Record<string, unknown>;
    expect(newPayload.name).toBe("AYUDANTE GENERAL");
    expect(newPayload.vacancies).toBe(80);
  });

  it("recruiter de Tenant B no ve la posición de Tenant A (RLS cross-tenant 404)", async () => {
    // Buscar la posición creada en el test anterior
    const adminDb = getAdminDb();
    const [pos] = await adminDb
      .select()
      .from(clientPositions)
      .where(
        and(
          eq(clientPositions.tenantId, tenantA.tenantId),
          eq(clientPositions.name, "AYUDANTE GENERAL"),
        ),
      )
      .limit(1);
    expect(pos).toBeDefined();

    // Recruiter del Tenant B intenta leer — RLS hace que no aparezca.
    const res = await app.request(
      `/api/clients/${tenantA.clientId}/positions/${pos.id}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${recruiterTokenB}` },
      },
      env,
    );
    // 404 uniforme (FR-016) — sin filtrar la existencia.
    expect(res.status).toBe(404);
  });

  it("PATCH partial update emite audit con diff (sólo campos cambiados)", async () => {
    const adminDb = getAdminDb();
    const [pos] = await adminDb
      .select()
      .from(clientPositions)
      .where(
        and(
          eq(clientPositions.tenantId, tenantA.tenantId),
          eq(clientPositions.name, "AYUDANTE GENERAL"),
        ),
      )
      .limit(1);

    const res = await app.request(
      `/api/clients/${tenantA.clientId}/positions/${pos.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aeTokenA}`,
        },
        body: JSON.stringify({ salaryAmount: 2050 }),
      },
      env,
    );
    expect(res.status).toBe(200);

    const auditRows = await adminDb
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantA.tenantId),
          eq(auditEvents.targetType, "client_position"),
          eq(auditEvents.action, "update"),
          eq(auditEvents.targetId, pos.id),
        ),
      );
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
    const last = auditRows[auditRows.length - 1];
    const newPayload = last.newValues as Record<string, unknown>;
    expect(Object.keys(newPayload)).toContain("salaryAmount");
  });
});
