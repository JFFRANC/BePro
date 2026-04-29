import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  passwordResetRequestSchema,
  type PasswordResetRequestValues,
} from "@bepro/shared";
import { usePasswordResetRequest } from "../hooks/usePasswordResetRequest";

const SUCCESS_COPY =
  "Si la cuenta existe, te hemos enviado un enlace para restablecer tu contraseña.";

export function ForgotPasswordForm() {
  const mutation = usePasswordResetRequest();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: PasswordResetRequestValues) => {
    mutation.mutate(data);
  };

  if (mutation.isSuccess) {
    return (
      <div className="space-y-4 w-full max-w-sm">
        <div
          role="status"
          className="rounded-md border border-input bg-muted/30 p-4 text-sm text-foreground"
        >
          {SUCCESS_COPY}
        </div>
        <Link
          to="/login"
          className="block text-center text-sm text-primary hover:underline"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 w-full max-w-sm"
    >
      <div>
        <label
          htmlFor="forgot-password-email"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Email
        </label>
        <input
          id="forgot-password-email"
          type="email"
          placeholder="correo@ejemplo.com"
          autoComplete="email"
          {...register("email")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {mutation.isPending ? "Enviando..." : "Enviar enlace"}
      </button>

      <Link
        to="/login"
        className="block text-center text-sm text-primary hover:underline"
      >
        Volver al inicio de sesión
      </Link>
    </form>
  );
}
