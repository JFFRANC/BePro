import { z } from "zod";

// 011-puestos-profile-docs — Enum unions (single source of truth)

// Los `type X = z.infer<...>` se exportan desde `../types/positions.ts` para
// evitar duplicados en el barrel de `index.ts`. Aquí solo viven los schemas.

export const positionGenderEnum = z.enum([
  "masculino",
  "femenino",
  "indistinto",
]);

export const positionCivilStatusEnum = z.enum([
  "soltero",
  "casado",
  "indistinto",
]);

export const positionEducationLevelEnum = z.enum([
  "ninguna",
  "primaria",
  "secundaria",
  "preparatoria",
  "tecnica",
  "licenciatura",
  "posgrado",
]);

export const positionPaymentFrequencyEnum = z.enum([
  "weekly",
  "biweekly",
  "monthly",
]);

export const positionShiftEnum = z.enum(["fixed", "rotating"]);

// Tres únicas monedas soportadas hoy. Si necesitamos más, lo extendemos
// aquí — pero un input libre de 3 chars permitía "XYZ" / "abc" basura.
export const positionCurrencyEnum = z.enum(["MXN", "USD", "EUR"]);

export const positionWorkDayEnum = z.enum([
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
]);

export const positionDocumentTypeEnum = z.enum(["contract", "pase_visita"]);

// -- Position profile shape --

const profileFieldsBase = {
  vacancies: z.number().int().min(1).max(32767).nullable().optional(),
  workLocation: z.string().max(500).nullable().optional(),
  ageMin: z.number().int().min(0).max(120).nullable().optional(),
  ageMax: z.number().int().min(0).max(120).nullable().optional(),
  gender: positionGenderEnum.nullable().optional(),
  civilStatus: positionCivilStatusEnum.nullable().optional(),
  educationLevel: positionEducationLevelEnum.nullable().optional(),
  experienceText: z.string().max(2000).nullable().optional(),
  salaryAmount: z
    .number()
    .nonnegative()
    .max(99999999.99)
    .multipleOf(0.01)
    .nullable()
    .optional(),
  salaryCurrency: positionCurrencyEnum.nullable().optional(),
  paymentFrequency: positionPaymentFrequencyEnum.nullable().optional(),
  salaryNotes: z.string().max(2000).nullable().optional(),
  benefits: z.string().max(4000).nullable().optional(),
  scheduleText: z.string().max(2000).nullable().optional(),
  workDays: z.array(positionWorkDayEnum).nullable().optional(),
  shift: positionShiftEnum.nullable().optional(),
  requiredDocuments: z
    .array(z.string().min(1).max(200))
    .nullable()
    .optional(),
  responsibilities: z.string().max(4000).nullable().optional(),
  // FAQ es lista plana de strings (clarificación Q2 — checklist de filtros, no Q/A)
  faq: z.array(z.string().min(1).max(2000)).nullable().optional(),
};

const ageRangeRefine = (data: {
  ageMin?: number | null | undefined;
  ageMax?: number | null | undefined;
}) => {
  if (
    data.ageMin !== null &&
    data.ageMin !== undefined &&
    data.ageMax !== null &&
    data.ageMax !== undefined
  ) {
    return data.ageMin <= data.ageMax;
  }
  return true;
};

const ageRangeIssue = {
  message: "El rango de edad mínimo no puede ser mayor que el máximo.",
  path: ["ageMin"],
};

export const createPositionProfileSchema = z
  .object({
    name: z.string().min(1, "El nombre del puesto es requerido").max(200),
    ...profileFieldsBase,
  })
  .refine(ageRangeRefine, ageRangeIssue);

export type CreatePositionProfileInput = z.infer<
  typeof createPositionProfileSchema
>;

export const updatePositionProfileSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    ...profileFieldsBase,
  })
  .refine(ageRangeRefine, ageRangeIssue);

export type UpdatePositionProfileInput = z.infer<
  typeof updatePositionProfileSchema
>;

// -- Position document upload --

export const POSITION_DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type PositionDocumentMimeType =
  (typeof POSITION_DOCUMENT_ALLOWED_MIME_TYPES)[number];

export const MAX_POSITION_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MiB (FR-013)

export const createPositionDocumentSchema = z.object({
  type: positionDocumentTypeEnum,
  originalName: z.string().min(1).max(255),
  mimeType: z.enum(POSITION_DOCUMENT_ALLOWED_MIME_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_POSITION_DOCUMENT_BYTES),
});

export type CreatePositionDocumentInput = z.infer<
  typeof createPositionDocumentSchema
>;

// -- Backwards compatibility — old name aliases (used by existing routes) --
// La API histórica usaba `createPositionSchema` / `updatePositionSchema` con
// solo `{ name }`. Apuntamos los aliases al esquema de perfil completo para que
// el feature 011 reemplace la validación sin tocar firmas externas.
export const createPositionSchema = createPositionProfileSchema;
export const updatePositionSchema = updatePositionProfileSchema;
export type CreatePositionFormValues = CreatePositionProfileInput;
export type UpdatePositionFormValues = UpdatePositionProfileInput;
