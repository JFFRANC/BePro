// 012-client-detail-ux / T005 — integration RLS test for description and
// contact.position. Uses app_worker role (DATABASE_URL_WORKER) — proves that
// tenant A cannot read tenant B's description or contact position.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { clients, clientContacts } from "@bepro/db";
import {
  cleanupTenant,
  getAdminDb,
  getWorkerDb,
  seedTenant,
  withTenantScope,
  type SeededTenant,
} from "../../candidates/__tests__/_integration/harness.js";

const HAS_DB = !!process.env.DATABASE_URL_WORKER;

describe.skipIf(!HAS_DB)(
  "012 — RLS: clients.description + client_contacts.position",
  () => {
    let tenantA: SeededTenant;
    let tenantB: SeededTenant;
    let contactBId: string;

    beforeAll(async () => {
      tenantA = await seedTenant();
      tenantB = await seedTenant();

      const adminDb = getAdminDb();

      // Seed tenant B's client.description and a contact.position
      await adminDb
        .update(clients)
        .set({
          description: "Datos confidenciales del tenant B",
        })
        .where(eq(clients.id, tenantB.clientId));

      const [contactB] = await adminDb
        .insert(clientContacts)
        .values({
          tenantId: tenantB.tenantId,
          clientId: tenantB.clientId,
          name: "Contacto B",
          phone: "+524420000000",
          email: `contact-b-${tenantB.slug}@test.bepro.mx`,
          position: "Recursos Humanos",
        })
        .returning({ id: clientContacts.id });
      contactBId = contactB.id;
    });

    afterAll(async () => {
      await cleanupTenant(tenantA.tenantId);
      await cleanupTenant(tenantB.tenantId);
    });

    it("tenant A scope cannot SELECT tenant B's client.description (RLS)", async () => {
      const workerDb = getWorkerDb();
      const rows = await withTenantScope(workerDb, tenantA.tenantId, (tx) =>
        tx
          .select({ id: clients.id, description: clients.description })
          .from(clients)
          .where(eq(clients.id, tenantB.clientId)),
      );
      expect(rows).toHaveLength(0);
    });

    it("tenant A scope cannot SELECT tenant B's contact.position (RLS)", async () => {
      const workerDb = getWorkerDb();
      const rows = await withTenantScope(workerDb, tenantA.tenantId, (tx) =>
        tx
          .select({ id: clientContacts.id, position: clientContacts.position })
          .from(clientContacts)
          .where(eq(clientContacts.id, contactBId)),
      );
      expect(rows).toHaveLength(0);
    });

    it("tenant B scope reads its own description and contact.position (sanity)", async () => {
      const workerDb = getWorkerDb();
      const result = await withTenantScope(
        workerDb,
        tenantB.tenantId,
        async (tx) => {
          const [c] = await tx
            .select({ description: clients.description })
            .from(clients)
            .where(eq(clients.id, tenantB.clientId));
          const [contact] = await tx
            .select({ position: clientContacts.position })
            .from(clientContacts)
            .where(eq(clientContacts.id, contactBId));
          return { c, contact };
        },
      );
      expect(result.c?.description).toBe("Datos confidenciales del tenant B");
      expect(result.contact?.position).toBe("Recursos Humanos");
    });
  },
);
