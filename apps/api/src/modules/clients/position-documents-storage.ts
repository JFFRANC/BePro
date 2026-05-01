// 011-puestos-profile-docs / US2 — constantes + storage key builder.
//
// Reusa el patrón ADR-002 (server-proxied via FILES R2 binding). No usa
// presigned URLs ni @aws-sdk. Sanitiza el nombre del archivo para evitar
// path traversal o caracteres problemáticos en URLs.

const SAFE_NAME_MAX = 250;

export const MAX_POSITION_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MiB (FR-013)

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface BuildPositionStorageKeyInput {
  tenantId: string;
  positionId: string;
  documentId: string;
  originalName: string;
}

export function buildPositionStorageKey(
  input: BuildPositionStorageKeyInput,
): string {
  const safe = sanitizeFileName(input.originalName);
  return `tenants/${input.tenantId}/positions/${input.positionId}/documents/${input.documentId}-${safe}`;
}

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
