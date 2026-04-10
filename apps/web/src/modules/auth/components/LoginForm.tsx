import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@bepro/shared";
import { useAuth } from "../hooks/useAuth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
        <Label htmlFor="tenantSlug" className="mb-1">
          Organización
        </Label>
        <Input
          id="tenantSlug"
          type="text"
          placeholder="mi-empresa"
          {...register("tenantSlug")}
        />
        {errors.tenantSlug && (
          <p className="text-sm text-destructive mt-1">{errors.tenantSlug.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email" className="mb-1">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="correo@ejemplo.com"
          error={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="password" className="mb-1">
          Contraseña
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          error={!!errors.password}
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-md p-2">{error}</p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
      </Button>
    </form>
  );
}
