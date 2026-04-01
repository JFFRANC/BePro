import { z } from "zod";

export const candidateSchema = z.object({
  fullName: z.string().min(1, "El nombre es requerido").max(200),
  phone: z.string().min(1, "El teléfono es requerido").max(20),
  interviewDate: z.string().min(1, "La fecha de entrevista es requerida"),
  clientId: z.string().min(1, "El cliente es requerido"),
  interviewTime: z.string().optional(),
  position: z.string().max(200).optional(),
  municipality: z.string().max(200).optional(),
  age: z.string().optional(),
  shift: z.string().max(100).optional(),
  plant: z.string().max(200).optional(),
  interviewPoint: z.string().max(200).optional(),
  comments: z.string().max(1000).optional(),
});

export type CandidateFormValues = z.infer<typeof candidateSchema>;
