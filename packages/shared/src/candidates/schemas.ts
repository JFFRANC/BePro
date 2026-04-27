// 007-candidates-module — Zod schemas compartidos entre API y Web (contratos en specs/.../contracts)
import { z } from "zod";
import { CANDIDATE_STATUSES, type CandidateStatus } from "./status.js";

const uuidSchema = z.string().uuid();

export const candidateStatusSchema = z.enum(
  CANDIDATE_STATUSES as unknown as [CandidateStatus, ...CandidateStatus[]],
);

// POST /api/candidates — Registrar candidato (US1, contracts §1)
// 008-ux-roles-refinements / US7 (FR-RP-002): privacy_notice_id + privacy_acknowledged
// are now optional. Recruiter-driven flow does not surface them in the UI; the
// constitution v1.0.2 §VI permits offline evidence collection. Legacy clients
// that still send the pair continue to work (service validates when present).
export const registerCandidateRequestSchema = z.object({
  client_id: uuidSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  phone: z.string().min(1).max(40),
  email: z.string().email().max(255),
  current_position: z.string().max(200).optional(),
  source: z.string().min(1).max(100),
  additional_fields: z.record(z.string(), z.unknown()).optional().default({}),
  privacy_notice_id: uuidSchema.optional(),
  privacy_acknowledged: z.literal(true).optional(),
  duplicate_confirmation: z
    .object({ confirmed_duplicate_ids: z.array(uuidSchema).min(1) })
    .optional(),
});
export type RegisterCandidateRequest = z.infer<
  typeof registerCandidateRequestSchema
>;

// GET /api/candidates — Listado y filtros (US2, contracts §2)
const csvList = <T extends z.ZodTypeAny>(item: T) =>
  z
    .union([item, z.array(item)])
    .transform((v): z.infer<T>[] => (Array.isArray(v) ? v : [v]));

export const listCandidatesQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: csvList(candidateStatusSchema).optional(),
  client_id: csvList(uuidSchema).optional(),
  recruiter_user_id: csvList(uuidSchema).optional(),
  rejection_category_id: csvList(uuidSchema).optional(),
  decline_category_id: csvList(uuidSchema).optional(),
  updated_from: z.string().datetime().optional(),
  updated_to: z.string().datetime().optional(),
  include_inactive: z.coerce.boolean().optional().default(false),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});
export type ListCandidatesQuery = z.infer<typeof listCandidatesQuerySchema>;

// PATCH /api/candidates/:id — Editar PII (US6 / FR-011b, contracts §4)
export const updateCandidatePiiSchema = z
  .object({
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
    phone: z.string().min(1).max(40).optional(),
    email: z.string().email().max(255).optional(),
    current_position: z.string().max(200).optional(),
    source: z.string().min(1).max(100).optional(),
    additional_fields: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Debes proporcionar al menos un campo a editar",
  });
export type UpdateCandidatePiiInput = z.infer<typeof updateCandidatePiiSchema>;

// POST /api/candidates/:id/transitions — Cambio de estado (US3, contracts §5)
export const transitionRequestSchema = z
  .object({
    from_status: candidateStatusSchema,
    to_status: candidateStatusSchema,
    rejection_category_id: uuidSchema.optional(),
    decline_category_id: uuidSchema.optional(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.to_status !== "rejected" || v.rejection_category_id, {
    message: "rejection_category_id es requerido cuando to_status='rejected'",
    path: ["rejection_category_id"],
  })
  .refine((v) => v.to_status !== "declined" || v.decline_category_id, {
    message: "decline_category_id es requerido cuando to_status='declined'",
    path: ["decline_category_id"],
  });
export type TransitionRequest = z.infer<typeof transitionRequestSchema>;

// POST /api/candidates/:id/reactivate — Reactivar candidato (US3 / FR-038a, contracts §5a)
export const reactivateRequestSchema = z.object({
  note: z.string().max(500).optional(),
});
export type ReactivateRequest = z.infer<typeof reactivateRequestSchema>;

// POST /api/candidates/:id/attachments — Iniciar subida (US4, contracts §6)
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png",
  "application/zip",
] as const;

export const attachmentInitSchema = z.object({
  file_name: z.string().min(1).max(255),
  mime_type: z.enum(ALLOWED_MIME_TYPES, {
    message: "Tipo de archivo no permitido",
  }),
  size_bytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, "El archivo excede el límite de 10 MB"),
  tag: z.string().max(50).optional(),
});
export type AttachmentInitInput = z.infer<typeof attachmentInitSchema>;

export const attachmentObsoleteSchema = z.object({
  is_obsolete: z.boolean(),
});
export type AttachmentObsoleteInput = z.infer<typeof attachmentObsoleteSchema>;

// GET /api/candidates/duplicates — Sondeo de duplicados (US1, contracts §10)
export const duplicateProbeQuerySchema = z.object({
  client_id: uuidSchema,
  phone: z.string().min(1).max(40),
});
export type DuplicateProbeQuery = z.infer<typeof duplicateProbeQuerySchema>;

// CRUD de categorías (US5, contracts §11)
export const categoryCreateSchema = z.object({
  label: z.string().min(1).max(100),
});
export const categoryUpdateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

// POST /api/retention-reviews — Revisión anual (FR-003a, contracts §12)
export const retentionReviewCreateSchema = z.object({
  justification_text: z.string().min(1).max(2000),
});
export type RetentionReviewCreateInput = z.infer<
  typeof retentionReviewCreateSchema
>;

// DTO compartido — vista resumida del candidato para el listado (contracts §2)
export interface ICandidateListItem {
  id: string;
  first_name: string;
  last_name: string;
  client: { id: string; name: string };
  status: CandidateStatus;
  updated_at: string;
  registering_user: { id: string; display_name: string };
  is_active: boolean;
}

// DTO completo — devuelto por GET /api/candidates/:id (contracts §3)
export interface ICandidateDetail extends ICandidateListItem {
  tenant_id: string;
  client_id: string;
  registering_user_id: string;
  phone: string;
  email: string;
  current_position?: string | null;
  source: string;
  additional_fields: Record<string, unknown>;
  rejection_category_id?: string | null;
  decline_category_id?: string | null;
  // 008-ux-roles-refinements / US7 — historical columns preserved read-only;
  // new recruiter-driven registrations are null under LFPDPPP offline-evidence model.
  privacy_notice_id?: string | null;
  privacy_notice_acknowledged_at?: string | null;
  created_at: string;
}

export interface IDuplicateSummary {
  id: string;
  first_name: string;
  last_name: string;
  status: CandidateStatus;
  created_at: string;
  registering_user: { id: string; display_name: string };
}
