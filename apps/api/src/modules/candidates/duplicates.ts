// 007-candidates-module — normalización de teléfono y búsqueda de duplicados (R2 / FR-014)
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@bepro/db";
import { candidates, users } from "@bepro/db";
import type { CandidateStatus, IDuplicateSummary } from "@bepro/shared";

const MEXICO_CC = "52";
const COMMON_CCS = new Set(["52", "1", "44", "34", "33", "49", "39", "55"]);

// Normaliza un número telefónico a sólo dígitos y quita el código de país inicial
// si lo encuentra. Mantiene los demás dígitos intactos.
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";

  // Si el original empezaba con + y el primer fragmento coincide con un código común, lo quitamos.
  if (raw.trim().startsWith("+")) {
    if (digits.startsWith(MEXICO_CC) && digits.length > 10) {
      return digits.slice(MEXICO_CC.length);
    }
    for (const cc of COMMON_CCS) {
      if (digits.startsWith(cc) && digits.length > 10) {
        return digits.slice(cc.length);
      }
    }
  }

  // Heurística secundaria: si tenemos 12 dígitos empezando con 52 (sin +), también lo quitamos.
  if (digits.length === 12 && digits.startsWith(MEXICO_CC)) {
    return digits.slice(MEXICO_CC.length);
  }

  return digits;
}

export interface FindDuplicatesInput {
  tenantId: string;
  clientId: string;
  phoneRaw: string;
}

// Busca candidatos activos del mismo tenant + cliente con el mismo phone_normalized.
// El llamador YA debe estar dentro de una transacción con SET LOCAL app.tenant_id.
export async function findDuplicatesForCandidate(
  db: Database,
  input: FindDuplicatesInput,
): Promise<IDuplicateSummary[]> {
  const phoneNormalized = normalizePhone(input.phoneRaw);
  if (!phoneNormalized) return [];

  const rows = await db
    .select({
      id: candidates.id,
      first_name: candidates.firstName,
      last_name: candidates.lastName,
      status: candidates.status,
      created_at: candidates.createdAt,
      registering_user_id: candidates.registeringUserId,
    })
    .from(candidates)
    .where(
      and(
        eq(candidates.tenantId, input.tenantId),
        eq(candidates.clientId, input.clientId),
        eq(candidates.phoneNormalized, phoneNormalized),
        eq(candidates.isActive, true),
      ),
    );

  if (rows.length === 0) return [];

  const recruiterIds = Array.from(new Set(rows.map((r) => r.registering_user_id)));
  const recruiters = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(inArray(users.id, recruiterIds));

  const recruiterMap = new Map(
    recruiters.map((r) => [r.id, `${r.firstName} ${r.lastName}`.trim()]),
  );

  return rows.map((r) => ({
    id: r.id,
    first_name: r.first_name,
    last_name: r.last_name,
    status: r.status as CandidateStatus,
    created_at: r.created_at.toISOString(),
    registering_user: {
      id: r.registering_user_id,
      display_name: recruiterMap.get(r.registering_user_id) ?? "—",
    },
  }));
}
