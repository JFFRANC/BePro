import { z } from "zod";

// 32 bytes URL-safe base64 (no padding) → exactly 43 ASCII chars.
const RESET_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Email inválido").max(255),
});

export type PasswordResetRequestValues = z.infer<
  typeof passwordResetRequestSchema
>;

// New-password rules per FR-008: at least one letter, one digit, one
// non-alphanumeric. Stricter than the existing user-create passwordSchema.
const newPasswordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(128, "La contraseña no puede exceder 128 caracteres")
  .regex(/[A-Za-z]/, "La contraseña debe contener al menos una letra")
  .regex(/[0-9]/, "La contraseña debe contener al menos un número")
  .regex(
    /[^A-Za-z0-9]/,
    "La contraseña debe contener al menos un carácter especial",
  );

export const passwordResetConfirmSchema = z.object({
  token: z.string().regex(RESET_TOKEN_REGEX, "Token inválido"),
  password: newPasswordSchema,
});

export type PasswordResetConfirmValues = z.infer<
  typeof passwordResetConfirmSchema
>;
