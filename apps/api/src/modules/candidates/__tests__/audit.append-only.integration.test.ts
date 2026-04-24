// T126 — Prueba de "append-only" para audit_events a nivel de privilegios Postgres.
//
// Objetivo (FR-062): demostrar que el rol `app_worker` NO tiene privilegios
// UPDATE ni DELETE sobre `audit_events`. Postgres evalúa privilegios ANTES que
// las políticas RLS, de modo que cualquier intento debe fallar con
// "permission denied for table audit_events" — independientemente de RLS.
//
// Diseño:
//   - `getAdminDb()` (neondb_owner / BYPASSRLS) se usa SOLO para seedear una
//     fila de auditoría y para cleanup. Jamás para los intentos UPDATE/DELETE,
//     porque el owner pasaría por encima de cualquier GRANT/RLS y daría un
//     falso verde.
//   - `getWorkerDb()` (app_worker / NOBYPASSRLS) es el rol con el que corre el
//     Worker en producción. Los tests 2 y 3 abren transacciones con
//     `SET LOCAL app.tenant_id` para que el contexto de tenant esté puesto;
//     así el error que salta es por privilegio (no por RLS vacía).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { auditEvents } from "@bepro/db";
import { sql, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  getAdminDb,
  getWorkerDb,
  seedTenant,
  cleanupTenant,
  withTenantScope,
  type SeededTenant,
} from "./_integration/harness.js";

describe("audit_events es append-only para app_worker (FR-062)", () => {
  let tenant: SeededTenant;
  let seededRowId: string;

  beforeAll(async () => {
    tenant = await seedTenant();

    // Fila de auditoría sembrada con el owner (BYPASSRLS). Es el "blanco"
    // sobre el que luego intentaremos UPDATE y DELETE desde app_worker.
    const [row] = await getAdminDb()
      .insert(auditEvents)
      .values({
        tenantId: tenant.tenantId,
        actorId: tenant.users.admin.id,
        action: "test.seed",
        targetType: "candidate",
        targetId: randomUUID(),
        oldValues: null,
        newValues: { v: "v1" },
      })
      .returning({ id: auditEvents.id });

    seededRowId = row.id;
  });

  afterAll(async () => {
    await cleanupTenant(tenant.tenantId);
  });

  it("app_worker PUEDE INSERT en audit_events con SET LOCAL (happy path)", async () => {
    const workerDb = getWorkerDb();

    // Conteo previo desde el owner para evitar que RLS nos oculte filas al contar.
    const beforeRows = await getAdminDb()
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenant.tenantId));

    await withTenantScope(workerDb, tenant.tenantId, async (tx) => {
      await tx.insert(auditEvents).values({
        tenantId: tenant.tenantId,
        actorId: tenant.users.admin.id,
        action: "test.worker_insert",
        targetType: "candidate",
        targetId: randomUUID(),
        oldValues: null,
        newValues: { v: "worker" },
      });
    });

    const afterRows = await getAdminDb()
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenant.tenantId));

    expect(afterRows.length).toBe(beforeRows.length + 1);
  });

  // Helper: extrae el mensaje más profundo de la cadena de errores. Drizzle
  // envuelve los errores de Postgres en "Failed query: ..." y el verdadero
  // mensaje ("permission denied for table audit_events") vive en err.cause.
  function deepErrorMessage(err: unknown): string {
    const visited = new Set<unknown>();
    let current: unknown = err;
    const parts: string[] = [];
    while (current && !visited.has(current)) {
      visited.add(current);
      const msg = (current as { message?: unknown })?.message;
      if (typeof msg === "string") parts.push(msg);
      current = (current as { cause?: unknown })?.cause;
    }
    return parts.join(" | ");
  }

  it("app_worker NO PUEDE UPDATE audit_events (permission denied antes que RLS)", async () => {
    const workerDb = getWorkerDb();

    let caught: unknown;
    try {
      await withTenantScope(workerDb, tenant.tenantId, async (tx) => {
        await tx.execute(
          sql`UPDATE audit_events SET new_values = '{"v":"tampered"}'::jsonb WHERE id = ${seededRowId}`,
        );
      });
    } catch (err) {
      caught = err;
    }

    expect(caught, "UPDATE audit_events debería haber sido rechazado").toBeTruthy();
    expect(deepErrorMessage(caught)).toMatch(/permission denied.*audit_events/i);
  });

  it("app_worker NO PUEDE DELETE audit_events (permission denied antes que RLS)", async () => {
    const workerDb = getWorkerDb();

    let caught: unknown;
    try {
      await withTenantScope(workerDb, tenant.tenantId, async (tx) => {
        await tx.execute(sql`DELETE FROM audit_events WHERE id = ${seededRowId}`);
      });
    } catch (err) {
      caught = err;
    }

    expect(caught, "DELETE audit_events debería haber sido rechazado").toBeTruthy();
    expect(deepErrorMessage(caught)).toMatch(/permission denied.*audit_events/i);
  });
});
