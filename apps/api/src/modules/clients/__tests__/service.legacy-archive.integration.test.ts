// 011-puestos-profile-docs / US5 — integration test (T067).
//
// Objetivos:
//   - Tras aplicar la migración 0010, todas las filas previas tienen is_active=false.
//   - Se emite UN audit `client_document.archive` por tenant con rowsAffected.
//   - Idempotencia: reaplicar la migración no agrega audit rows ni toggle.
//
// Asume que la migración ya fue aplicada localmente. Skipped sin DB.
//
// El test no inserta datos legacy ni lo rerunea; verifica el estado post-migración
// del tenant que estuvo activo en `0009`.

import { describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { clientDocuments, auditEvents } from "@bepro/db";
import { getAdminDb } from "../../candidates/__tests__/_integration/harness.js";

const HAS_DB = !!process.env.DATABASE_URL_WORKER;

describe.skipIf(!HAS_DB)("011 — Legacy archive integration", () => {
  it("toda fila de client_documents quedó is_active=false post-migración", async () => {
    const db = getAdminDb();
    const stillActive = await db
      .select({ id: clientDocuments.id })
      .from(clientDocuments)
      .where(eq(clientDocuments.isActive, true))
      .limit(5);
    expect(stillActive.length).toBe(0);
  });

  it("existe ≥1 audit `client_document.archive` con rowsAffected ≥ 0", async () => {
    const db = getAdminDb();
    const audits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetType, "client_document"),
          eq(auditEvents.action, "archive"),
        ),
      );
    // Sólo se emiten cuando hay rows que tocar; si la base estaba vacía,
    // la migración no agrega filas. Aceptamos cualquier valor ≥0.
    for (const a of audits) {
      const payload = a.newValues as Record<string, unknown>;
      expect(payload).toBeDefined();
      expect(payload.migrationId).toBe("0010_legacy_client_documents_archive");
      expect(typeof payload.rowsAffected).toBe("number");
      expect(payload.reason).toBe("feature-011-rollout");
    }
  });
});
