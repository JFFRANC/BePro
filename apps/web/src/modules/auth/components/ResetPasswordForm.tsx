import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { passwordResetConfirmSchema } from "@bepro/shared";
import { usePasswordResetConfirm } from "../hooks/usePasswordResetConfirm";

// Extend the shared schema with a client-only `confirmPassword` field that
// must match `password`. The backend never sees `confirmPassword`.
const formSchema = passwordResetConfirmSchema
  .omit({ token: true })
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof formSchema>;

const INVALID_LINK_COPY =
  "El enlace ha expirado o ya fue utilizado. Solicita uno nuevo.";

export function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const tokenIsMissing = token.length === 0;

  const mutation = usePasswordResetConfirm();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (mutation.isSuccess) {
      navigate("/", { replace: true });
    }
  }, [mutation.isSuccess, navigate]);

  if (tokenIsMissing || mutation.isError) {
    return (
      <div className="space-y-4 w-full max-w-sm">
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {INVALID_LINK_COPY}
        </div>
        <Link
          to="/forgot-password"
          className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Solicitar otro enlace
        </Link>
      </div>
    );
  }

  const onSubmit = (data: FormValues) => {
    mutation.mutate({ token, password: data.password });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 w-full max-w-sm"
    >
      <div>
        <label
          htmlFor="reset-password-new"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Nueva contraseña
        </label>
        <input
          id="reset-password-new"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          {...register("password")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {errors.password && (
          <p className="text-sm text-red-500 mt-1">
            {errors.password.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="reset-password-confirm"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Confirmar contraseña
        </label>
        <input
          id="reset-password-confirm"
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
          {...register("confirmPassword")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {errors.confirmPassword && (
          <p className="text-sm text-red-500 mt-1">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {mutation.isPending ? "Guardando..." : "Establecer contraseña"}
      </button>
    </form>
  );
}
