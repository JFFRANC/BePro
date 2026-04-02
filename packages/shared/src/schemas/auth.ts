import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
  tenantSlug: z
    .string()
    .min(3, "El slug del tenant es requerido")
    .max(100)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Solo minúsculas, números y guiones",
    ),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
