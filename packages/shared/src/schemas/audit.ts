import { z } from "zod";
import {
  positionDocumentTypeEnum,
  positionGenderEnum,
  positionCivilStatusEnum,
  positionEducationLevelEnum,
  positionPaymentFrequencyEnum,
  positionShiftEnum,
  positionWorkDayEnum,
} from "./positions.js";

// 011-puestos-profile-docs — auditPayloadSchema reconoce los nuevos eventos

const positionProfilePayload = z.object({
  clientId: z.string().uuid().optional(),
  name: z.string().optional(),
  vacancies: z.number().int().nullable().optional(),
  ageMin: z.number().int().nullable().optional(),
  ageMax: z.number().int().nullable().optional(),
  gender: positionGenderEnum.nullable().optional(),
  civilStatus: positionCivilStatusEnum.nullable().optional(),
  educationLevel: positionEducationLevelEnum.nullable().optional(),
  experienceText: z.string().nullable().optional(),
  salaryAmount: z.union([z.string(), z.number()]).nullable().optional(),
  salaryCurrency: z.string().nullable().optional(),
  paymentFrequency: positionPaymentFrequencyEnum.nullable().optional(),
  salaryNotes: z.string().nullable().optional(),
  benefits: z.string().nullable().optional(),
  scheduleText: z.string().nullable().optional(),
  workDays: z.array(positionWorkDayEnum).nullable().optional(),
  shift: positionShiftEnum.nullable().optional(),
  requiredDocuments: z.array(z.string()).nullable().optional(),
  responsibilities: z.string().nullable().optional(),
  faq: z.array(z.string()).nullable().optional(),
});

const positionDocumentNewPayload = z.object({
  positionId: z.string().uuid(),
  type: positionDocumentTypeEnum,
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  uploadedBy: z.string().uuid(),
});

const positionDocumentReplaceOldPayload = z.object({
  priorDocumentId: z.string().uuid(),
  priorReplacedAt: z.string(),
  priorOriginalName: z.string(),
  priorSizeBytes: z.number().int(),
});

const clientDocumentArchivePayload = z.object({
  rowsAffected: z.number().int().nonnegative(),
  migrationId: z.string(),
  reason: z.string(),
  executedAt: z.string(),
});

export const positionAuditPayloadSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({
      kind: z.literal("client_position.create"),
      old: z.null(),
      new: positionProfilePayload,
    }),
    z.object({
      kind: z.literal("client_position.update"),
      old: positionProfilePayload.partial(),
      new: positionProfilePayload.partial(),
    }),
    z.object({
      kind: z.literal("client_position.delete"),
      old: positionProfilePayload.partial(),
      new: z.null(),
    }),
    z.object({
      kind: z.literal("position_document.create"),
      old: z.null(),
      new: positionDocumentNewPayload,
    }),
    z.object({
      kind: z.literal("position_document.replace"),
      old: positionDocumentReplaceOldPayload,
      new: positionDocumentNewPayload,
    }),
    z.object({
      kind: z.literal("position_document.delete"),
      old: z.object({
        positionId: z.string().uuid(),
        type: positionDocumentTypeEnum,
        originalName: z.string(),
      }),
      new: z.null(),
    }),
    z.object({
      kind: z.literal("client_document.archive"),
      old: z.null(),
      new: clientDocumentArchivePayload,
    }),
  ],
);

export type PositionAuditPayload = z.infer<typeof positionAuditPayloadSchema>;
