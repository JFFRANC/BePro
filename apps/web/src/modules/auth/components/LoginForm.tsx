import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { loginSchema, type LoginFormValues } from "@bepro/shared";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";

// 008-ux-roles-refinements / US8 — single-tenant deploys ocultan el campo
// "Organización" y envían el slug fijo. Se evalúa al cargar el módulo para
// que `vi.stubEnv` + `vi.resetModules` puedan controlarlo en pruebas.
const FIXED_TENANT_SLUG = (
  import.meta.env.VITE_LOGIN_TENANT_FIXED ?? ""
).trim();

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
      tenantSlug: FIXED_TENANT_SLUG,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    try {
      const tenantSlug = FIXED_TENANT_SLUG || data.tenantSlug;
      await login(data.email, data.password, tenantSlug);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(
        axiosError.response?.data?.error ?? "Error al iniciar sesión",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full max-w-sm">
      {!FIXED_TENANT_SLUG && (
        <div>
          <label htmlFor="tenantSlug" className="block text-sm font-medium text-foreground mb-1">
            Organización
          </label>
          <input
            id="tenantSlug"
            type="text"
            placeholder="mi-empresa"
            autoComplete="organization"
            {...register("tenantSlug")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {errors.tenantSlug && (
            <p className="text-sm text-red-500 mt-1">{errors.tenantSlug.message}</p>
          )}
        </div>
      )}

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
        <Link
          to="/forgot-password"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          ¿Olvidaste tu contraseña?
        </Link>
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
