import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordFormValues } from "@bepro/shared";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useForceChangePassword } from "../hooks/useUsers";
import { PASSWORD_HINT } from "../constants";
import { getApiErrorMessage } from "@/lib/error-utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

export function ForcePasswordChangePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const forceChangePassword = useForceChangePassword(user?.id ?? "");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    try {
      await forceChangePassword.mutateAsync(data);
      toast.success("Contraseña actualizada exitosamente");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al cambiar la contraseña"));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-6 space-y-6">
        <div className="text-center space-y-2">
          <KeyRound className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Cambiar contraseña</h1>
          <p className="text-muted-foreground">
            Debes cambiar tu contraseña antes de continuar
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword" className="mb-1">
              Contraseña actual
            </Label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              placeholder="••••••••"
              error={!!errors.currentPassword}
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-sm text-destructive mt-1">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="newPassword" className="mb-1">
              Nueva contraseña
            </Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder="••••••••"
              error={!!errors.newPassword}
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p className="text-sm text-destructive mt-1">
                {errors.newPassword.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{PASSWORD_HINT}</p>
          </div>

          <Button type="submit" disabled={forceChangePassword.isPending} className="w-full">
            {forceChangePassword.isPending ? "Cambiando\u2026" : "Cambiar contraseña"}
          </Button>
        </form>
      </div>
    </div>
  );
}
