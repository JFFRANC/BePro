import { z } from "zod";

const userRoleEnum = z.enum([
  "admin",
  "manager",
  "account_executive",
  "recruiter",
]);

const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .regex(/[A-Z]/, "La contraseña debe contener al menos una mayúscula")
  .regex(/[a-z]/, "La contraseña debe contener al menos una minúscula")
  .regex(/[0-9]/, "La contraseña debe contener al menos un número");

export const createUserSchema = z
  .object({
    email: z.string().email("Email inválido"),
    password: passwordSchema,
    firstName: z
      .string()
      .min(1, "El nombre es requerido")
      .max(100, "El nombre no puede exceder 100 caracteres"),
    lastName: z
      .string()
      .min(1, "El apellido es requerido")
      .max(100, "El apellido no puede exceder 100 caracteres"),
    role: userRoleEnum,
    isFreelancer: z.boolean(),
    // 010 — primary client capture: required for AE/recruiter (refine), ignored
    // server-side for admin/manager. UUID validated when present.
    clientId: z.string().uuid("clientId debe ser un UUID válido").optional(),
  })
  .superRefine((data, ctx) => {
    const needsClient =
      data.role === "account_executive" || data.role === "recruiter";
    if (needsClient && !data.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientId"],
        message: "Cliente es requerido para este rol",
      });
    }
  });

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  firstName: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .optional(),
  lastName: z
    .string()
    .min(1, "El apellido es requerido")
    .max(100, "El apellido no puede exceder 100 caracteres")
    .optional(),
  role: userRoleEnum.optional(),
  isFreelancer: z.boolean().optional(),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: passwordSchema,
});

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: userRoleEnum.optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  isFreelancer: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type ListUsersQueryValues = z.infer<typeof listUsersQuerySchema>;

export const bulkImportRowSchema = z.object({
  email: z.string().email("Email inválido"),
  firstName: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede exceder 100 caracteres"),
  lastName: z
    .string()
    .min(1, "El apellido es requerido")
    .max(100, "El apellido no puede exceder 100 caracteres"),
  role: userRoleEnum,
  isFreelancer: z
    .enum(["true", "false"])
    .transform((v) => v === "true"),
});

export type BulkImportRowValues = z.infer<typeof bulkImportRowSchema>;
