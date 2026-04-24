// 007-candidates-module — redacción de PII para logs (R10 / FR-004 / FR-011a)
// Cualquier log dentro del módulo DEBE pasar por aquí o por un objeto-resumen seguro.

export const PII_KEYS_DEFAULT: ReadonlySet<string> = new Set([
  "first_name",
  "last_name",
  "firstName",
  "lastName",
  "full_name",
  "fullName",
  "phone",
  "phone_normalized",
  "phoneNormalized",
  "second_phone",
  "secondary_phone",
  "email",
  "curp",
  "rfc",
]);

export interface CandidateLike {
  id: string;
  tenant_id: string;
  client_id: string;
  registering_user_id: string;
  status: string;
  is_active: boolean;
  additional_fields?: Record<string, unknown>;
  // Cualquier otro campo es ignorado por redactCandidate.
  [key: string]: unknown;
}

export interface SafeCandidateSummary {
  id: string;
  tenant_id: string;
  client_id: string;
  registering_user_id: string;
  status: string;
  is_active: boolean;
  additional_fields?: Record<string, unknown>;
}

// Devuelve un objeto seguro con sólo identificadores no-PII.
export function redactCandidate(candidate: CandidateLike): SafeCandidateSummary {
  const safe: SafeCandidateSummary = {
    id: candidate.id,
    tenant_id: candidate.tenant_id,
    client_id: candidate.client_id,
    registering_user_id: candidate.registering_user_id,
    status: candidate.status,
    is_active: candidate.is_active,
  };

  if (candidate.additional_fields) {
    safe.additional_fields = redactObject(
      candidate.additional_fields,
      PII_KEYS_DEFAULT,
    ) as Record<string, unknown>;
  }

  return safe;
}

// Recorre recursivamente un objeto eliminando cualquier propiedad cuyo nombre
// esté en `piiKeys`. Devuelve una nueva referencia (no muta la entrada).
export function redactObject<T>(obj: T, piiKeys: ReadonlySet<string>): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, piiKeys)) as unknown as T;
  }
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (piiKeys.has(key)) continue;
    out[key] = redactObject(value, piiKeys);
  }
  return out as T;
}
