// 007-candidates-module — Helpers para R2 (R4)
// Sólo se construyen llaves y se sanitizan nombres aquí. La firma real de URLs
// (PUT y GET) se hará en el módulo de adjuntos (US4) usando el binding c.env.FILES.

const SAFE_NAME_MAX = 250;

export interface BuildStorageKeyInput {
  tenantId: string;
  candidateId: string;
  attachmentId: string;
  fileName: string;
}

export function buildStorageKey(input: BuildStorageKeyInput): string {
  const safe = sanitizeFileName(input.fileName);
  return `tenants/${input.tenantId}/candidates/${input.candidateId}/attachments/${input.attachmentId}/${safe}`;
}

// Sanitiza el nombre de archivo: separa la extensión, reemplaza caracteres
// no [A-Za-z0-9_-] por "_", colapsa secuencias y elimina underscores
// líderes/finales. Garantiza que no quedan separadores de ruta ni "..".
export function sanitizeFileName(name: string): string {
  const extMatch = name.match(/\.[A-Za-z0-9]{1,8}$/);
  const ext = extMatch?.[0] ?? "";
  const stem = ext ? name.slice(0, -ext.length) : name;

  const cleanedStem = stem
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const cleaned = (cleanedStem || "file") + ext;

  if (cleaned.length <= SAFE_NAME_MAX) return cleaned;

  const stemBudget = SAFE_NAME_MAX - ext.length;
  return cleaned.slice(0, stemBudget) + ext;
}
