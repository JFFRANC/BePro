import { z } from "zod";

export const clientFormConfigSchema = z.object({
  showInterviewTime: z.boolean().default(false),
  showPosition: z.boolean().default(false),
  showMunicipality: z.boolean().default(false),
  showAge: z.boolean().default(false),
  showShift: z.boolean().default(false),
  showPlant: z.boolean().default(false),
  showInterviewPoint: z.boolean().default(false),
  showComments: z.boolean().default(false),
});

export const createClientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  email: z.string().email("Formato de correo electrónico inválido").max(255).optional().or(z.literal("")),
  phone: z.string().max(20).regex(/^[\d\s+()-]*$/, "Formato de teléfono inválido").optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  formConfig: clientFormConfigSchema.optional(),
});

export type CreateClientFormValues = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email("Formato de correo electrónico inválido").max(255).optional().nullable().or(z.literal("")),
  phone: z.string().max(20).regex(/^[\d\s+()-]*$/, "Formato de teléfono inválido").optional().nullable().or(z.literal("")),
  address: z.string().max(500).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  isActive: z.boolean().optional(),
  formConfig: clientFormConfigSchema.optional(),
});

export type UpdateClientFormValues = z.infer<typeof updateClientSchema>;

export const listClientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(200).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
});

export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;

export const assignUserSchema = z.object({
  userId: z.string().uuid("ID de usuario inválido"),
  accountExecutiveId: z.string().uuid("ID de ejecutivo inválido").optional(),
});

export type AssignUserFormValues = z.infer<typeof assignUserSchema>;

export const createContactSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  phone: z
    .string()
    .min(7, "El teléfono debe tener al menos 7 dígitos")
    .max(20)
    .regex(/^[\d\s+()-]+$/, "Formato de teléfono inválido"),
  email: z
    .string()
    .email("Formato de correo electrónico inválido")
    .max(255),
});

export type CreateContactFormValues = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z
    .string()
    .min(7)
    .max(20)
    .regex(/^[\d\s+()-]+$/, "Formato de teléfono inválido")
    .optional(),
  email: z.string().email("Formato de correo electrónico inválido").max(255).optional(),
});

export type UpdateContactFormValues = z.infer<typeof updateContactSchema>;

export const createPositionSchema = z.object({
  name: z.string().min(1, "El nombre del puesto es requerido").max(200),
});

export type CreatePositionFormValues = z.infer<typeof createPositionSchema>;

export const updatePositionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

export type UpdatePositionFormValues = z.infer<typeof updatePositionSchema>;

export const documentTypeSchema = z.enum([
  "quotation",
  "interview_pass",
  "position_description",
]);

export type DocumentType = z.infer<typeof documentTypeSchema>;
