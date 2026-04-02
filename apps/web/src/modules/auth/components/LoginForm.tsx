import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@bepro/shared";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";

export function LoginForm() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      tenantSlug: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    try {
      await login(data.email, data.password, data.tenantSlug);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(
        axiosError.response?.data?.error ?? "Error al iniciar sesión",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full max-w-sm">
      <div>
        <label htmlFor="tenantSlug" className="block text-sm font-medium text-foreground mb-1">
          Organización
        </label>
        <input
          id="tenantSlug"
          type="text"
          placeholder="mi-empresa"
          {...register("tenantSlug")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {errors.tenantSlug && (
          <p className="text-sm text-red-500 mt-1">{errors.tenantSlug.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          placeholder="correo@ejemplo.com"
          {...register("email")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          {...register("password")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        {errors.password && (
          <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-md p-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
      </button>
    </form>
  );
}
