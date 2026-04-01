import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  contactInfo: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;
