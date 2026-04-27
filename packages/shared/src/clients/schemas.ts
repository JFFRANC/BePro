// 008-ux-roles-refinements — Zod schemas for client-scoped features
// (batch assignments, form-config custom fields).
import { z } from "zod";

const uuidSchema = z.string().uuid();

// --- Batch client assignment — polymorphic (AE + recruiter) ---
// POST /api/clients/:clientId/assignments/batch
// Desired-state diff. Admin/manager only. Sends the full target set:
//   { accountExecutives: [...], recruiters: [{ userId, accountExecutiveId? }] }
// accountExecutives is deduped silently. Recruiter.accountExecutiveId (the
// "líder" for this client) must reference a userId present in the same
// accountExecutives array — enforced both here and server-side.
export const batchAssignmentsSchema = z
  .object({
    accountExecutives: z
      .array(uuidSchema)
      .default([])
      .transform((ids) => Array.from(new Set(ids))),
    recruiters: z
      .array(
        z.object({
          userId: uuidSchema,
          accountExecutiveId: uuidSchema.optional(),
        }),
      )
      .default([]),
  })
  .superRefine((v, ctx) => {
    const aes = new Set(v.accountExecutives);
    const seen = new Set<string>();
    v.recruiters.forEach((r, i) => {
      if (aes.has(r.userId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruiters", i, "userId"],
          message:
            "duplicate_across_lists: userId aparece tanto en accountExecutives como en recruiters.",
        });
      }
      if (seen.has(r.userId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruiters", i, "userId"],
          message: "duplicate_user: userId duplicado en recruiters.",
        });
      }
      seen.add(r.userId);
      if (r.accountExecutiveId && !aes.has(r.accountExecutiveId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["recruiters", i, "accountExecutiveId"],
          message:
            "leader_not_in_desired_ae_set: accountExecutiveId debe referenciar un userId presente en accountExecutives.",
        });
      }
    });
  });
export type BatchAssignmentsInput = z.infer<typeof batchAssignmentsSchema>;
export type BatchAssignmentsRecruiter = BatchAssignmentsInput["recruiters"][number];
export interface BatchAssignmentsResult {
  clientId: string;
  added: {
    userId: string;
    role: "account_executive" | "recruiter";
    at: string;
  }[];
  removed: {
    userId: string;
    reason: "explicit" | "cascade";
    at: string;
  }[];
  reparented: {
    userId: string;
    from: string | null;
    to: string | null;
    at: string;
  }[];
  unchanged: string[];
}

// --- Admin-managed custom formConfig fields (US6) ---
// Key: lowercase snake-case, must not collide with legacy toggles.
const LEGACY_FORM_CONFIG_KEYS = new Set<string>([
  "showAge",
  "showPlant",
  "showShift",
  "showComments",
  "showPosition",
  "showMunicipality",
  "showInterviewTime",
  "showInterviewPoint",
]);

const fieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,30}$/, {
    message:
      "La clave debe iniciar con letra minúscula y contener solo minúsculas, dígitos o guiones bajos (máx. 31 caracteres).",
  })
  .refine((k) => !LEGACY_FORM_CONFIG_KEYS.has(k), {
    message: "La clave colisiona con un toggle legacy reservado.",
  });

export const FORM_CONFIG_FIELD_TYPES = [
  "text",
  "number",
  "date",
  "checkbox",
  "select",
] as const;
export type FormConfigFieldType = (typeof FORM_CONFIG_FIELD_TYPES)[number];

const fieldTypeSchema = z.enum(FORM_CONFIG_FIELD_TYPES);

// Full field shape as stored in clients.form_config.fields[].
export const formConfigFieldSchema = z
  .object({
    key: fieldKeySchema,
    label: z.string().min(1).max(80),
    type: fieldTypeSchema,
    required: z.boolean().default(false),
    options: z.array(z.string().min(1)).nullable().optional(),
    archived: z.boolean().default(false),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .superRefine((f, ctx) => {
    if (f.type === "select") {
      if (!f.options || f.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Los campos 'select' requieren al menos una opción.",
        });
      }
    } else if (f.options && f.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Solo los campos 'select' pueden definir opciones.",
      });
    }
  });
export type FormConfigField = z.infer<typeof formConfigFieldSchema>;

// Create payload — server stamps createdAt/updatedAt.
export const createFormConfigFieldSchema = z
  .object({
    key: fieldKeySchema,
    label: z.string().min(1).max(80),
    type: fieldTypeSchema,
    required: z.boolean().optional().default(false),
    options: z.array(z.string().min(1)).nullable().optional(),
  })
  .superRefine((f, ctx) => {
    if (f.type === "select") {
      if (!f.options || f.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Los campos 'select' requieren al menos una opción.",
        });
      }
    } else if (f.options && f.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Solo los campos 'select' pueden definir opciones.",
      });
    }
  });
export type CreateFormConfigFieldInput = z.infer<
  typeof createFormConfigFieldSchema
>;

// Patch payload — `key` and `type` are immutable.
export const patchFormConfigFieldSchema = z
  .object({
    label: z.string().min(1).max(80).optional(),
    required: z.boolean().optional(),
    options: z.array(z.string().min(1)).nullable().optional(),
    archived: z.boolean().optional(),
    // Immutables — present here only to reject explicitly.
    key: z.never().optional(),
    type: z.never().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Debes proporcionar al menos un campo a actualizar.",
  });
export type PatchFormConfigFieldInput = z.infer<
  typeof patchFormConfigFieldSchema
>;
