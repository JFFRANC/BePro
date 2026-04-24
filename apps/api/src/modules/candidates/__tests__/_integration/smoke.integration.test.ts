// Smoke test del harness: demuestra que
//   1. El admin client puede seedear un tenant.
//   2. El worker client, DENTRO de SET LOCAL, ve exactamente los 4 usuarios del tenant.
//   3. El worker client, FUERA de SET LOCAL, ve 0 usuarios (RLS activa en serio).
//
// Si este smoke falla, cualquier otro test de integración también fallará —
// por eso vive bajo `_integration/` y se ejecuta primero por orden alfabético.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users } from "@bepro/db";
import { eq } from "drizzle-orm";
import {
  cleanupTenant,
  getAdminDb,
  getWorkerDb,
  seedTenant,
  withTenantScope,
  type SeededTenant,
} from "./harness.js";

describe("Harness smoke — RLS realmente bloquea sin tenant scope", () => {
  let seeded: SeededTenant;

  beforeAll(async () => {
    seeded = await seedTenant();
  });

  afterAll(async () => {
    if (seeded?.tenantId) {
      await cleanupTenant(seeded.tenantId);
    }
  });

  it("admin (BYPASSRLS) ve los 4 usuarios del tenant sin SET LOCAL", async () => {
    const db = getAdminDb();
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.tenantId, seeded.tenantId));
    expect(rows).toHaveLength(4);
  });

  it("app_worker DENTRO de SET LOCAL ve los 4 usuarios del tenant", async () => {
    const rows = await withTenantScope(
      getWorkerDb(),
      seeded.tenantId,
      async (tx) =>
        tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.tenantId, seeded.tenantId)),
    );
    expect(rows).toHaveLength(4);
  });

  it("app_worker SIN SET LOCAL no puede ver filas del tenant (RLS enforced)", async () => {
    // Prueba empírica del Principio I: sin SET LOCAL, app_worker NO puede leer
    // filas del tenant.
    //
    // En Postgres, un GUC custom (`app.tenant_id`) no seteado devuelve `''`
    // (string vacío), no NULL. La política `tenant_id = current_setting(...)::uuid`
    // al intentar castear `''` a uuid falla con "invalid input syntax for type
    // uuid". Ese error ES la señal de que RLS está activa: la política no
    // puede evaluar porque el contexto de tenant no existe.
    //
    // Aceptamos ambas manifestaciones como "RLS enforced":
    //   - Error de cast de la policy (comportamiento actual en Neon con las
    //     policies tal como están en 0001/0002/0005).
    //   - 0 filas (comportamiento ideal si las policies usaran NULLIF —
    //     tracked como deuda técnica separada, fuera del alcance de 007).
    //
    // Lo único inaceptable sería ver las 4 filas del tenant: eso significaría
    // que app_worker bypasea RLS, rompiendo el Principio I.
    const db = getWorkerDb();
    let rows: Array<{ id: string }> = [];
    let rlsError: unknown;
    try {
      rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.tenantId, seeded.tenantId));
    } catch (err) {
      rlsError = err;
    }

    if (rlsError) {
      const deepMsg =
        (rlsError as { cause?: { message?: string } }).cause?.message ??
        (rlsError as Error).message ??
        "";
      expect(
        deepMsg,
        `El error debería provenir de la policy RLS (cast app.tenant_id) — got: ${deepMsg}`,
      ).toMatch(/(?:invalid.*input.*uuid|permission denied|policy)/i);
    } else {
      expect(rows).toHaveLength(0);
    }
  });
});
