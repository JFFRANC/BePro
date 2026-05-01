// 012-client-detail-ux / T014 — integration test for the legacy form_config
// collision rename script. Seeds a tenant with a colliding `fullName` custom
// field plus a candidate with a value under that key, runs the script, then
// asserts the rename + value preservation + idempotency.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { clients, candidates, auditEvents } from "@bepro/db";
import {
  cleanupTenant,
  getAdminDb,
  seedTenant,
  type SeededTenant,
} from "../modules/candidates/__tests__/_integration/harness.js";
// 012-client-detail-ux — script lives in packages/db/scripts/ so it can resolve
// drizzle-orm + neon from the package's local node_modules.
import { processTenant } from "../../../../packages/db/scripts/012-rename-legacy-formconfig-collisions.js";

const HAS_DB = !!process.env.DATABASE_URL;

describe.skipIf(!HAS_DB)(
  "012 — pre-deploy migration script (collision rename)",
  () => {
    let tenant: SeededTenant;
    let candidateId: string;

    beforeAll(async () => {
      tenant = await seedTenant();
      const db = getAdminDb();
      // Inject a colliding custom field "fullName" into the seeded client.
      await db
        .update(clients)
        .set({
          formConfig: {
            fields: [
              {
                key: "fullName",
                label: "Nombre completo (legacy)",
                type: "text",
                required: true,
                options: null,
                archived: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                key: "shoe_size",
                label: "Talla de zapato",
                type: "text",
                required: false,
                options: null,
                archived: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          },
        })
        .where(eq(clients.id, tenant.clientId));

      // Insert a candidate carrying a value under the colliding key.
      const [c] = await db
        .insert(candidates)
        .values({
          tenantId: tenant.tenantId,
          clientId: tenant.clientId,
          registeringUserId: tenant.users.recruiter.id,
          firstName: "Pre",
          lastName: "Migration",
          phone: "+524420009999",
          phoneNormalized: "524420009999",
          email: `pre-mig-${tenant.slug}@test.bepro.mx`,
          source: "test-seed",
          status: "registered",
          additionalFields: {
            fullName: "Valor previo",
            shoe_size: "26",
          },
          privacyNoticeId: tenant.privacyNoticeId,
          privacyNoticeAcknowledgedAt: new Date(),
        })
        .returning({ id: candidates.id });
      candidateId = c.id;
    });

    afterAll(async () => {
      await cleanupTenant(tenant.tenantId);
    });

    it("renames the colliding custom field to legacy_<key>, preserves candidate values, writes audit", async () => {
      const db = getAdminDb();

      // Dry-run: should not write.
      const dryResult = await processTenant(db, tenant.tenantId, true);
      expect(dryResult.clientsRewritten).toBe(1);
      expect(dryResult.renames).toEqual(
        expect.arrayContaining([{ fromKey: "fullName", toKey: "legacy_fullName", count: 1 }]),
      );

      // Verify nothing changed in DB after dry-run.
      const [postDry] = await db
        .select({ formConfig: clients.formConfig })
        .from(clients)
        .where(eq(clients.id, tenant.clientId));
      const dryFields = (postDry.formConfig as { fields?: { key: string }[] }).fields ?? [];
      expect(dryFields.some((f) => f.key === "fullName")).toBe(true);

      // Real run.
      const realResult = await processTenant(db, tenant.tenantId, false);
      expect(realResult.clientsRewritten).toBe(1);
      expect(realResult.candidatesRewritten).toBe(1);

      // form_config rewritten.
      const [post] = await db
        .select({ formConfig: clients.formConfig })
        .from(clients)
        .where(eq(clients.id, tenant.clientId));
      const fields = (post.formConfig as { fields?: { key: string }[] }).fields ?? [];
      expect(fields.some((f) => f.key === "fullName")).toBe(false);
      expect(fields.some((f) => f.key === "legacy_fullName")).toBe(true);
      expect(fields.some((f) => f.key === "shoe_size")).toBe(true);

      // candidate.additional_fields rewritten.
      const [cand] = await db
        .select({ additionalFields: candidates.additionalFields })
        .from(candidates)
        .where(eq(candidates.id, candidateId));
      const af = cand.additionalFields as Record<string, unknown>;
      expect(af.fullName).toBeUndefined();
      expect(af.legacy_fullName).toBe("Valor previo");
      expect(af.shoe_size).toBe("26");

      // audit row written for this tenant.
      const auditRows = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.tenantId, tenant.tenantId),
            eq(auditEvents.action, "012_legacy_formconfig_collision_rename"),
          ),
        );
      expect(auditRows.length).toBeGreaterThanOrEqual(1);

      // Idempotency: re-run is a no-op.
      const second = await processTenant(db, tenant.tenantId, false);
      expect(second.clientsRewritten).toBe(0);
      expect(second.candidatesRewritten).toBe(0);
    });
  },
);
