import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changePasswordSchema, type ChangePasswordFormValues } from "@bepro/shared";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChangePassword } from "../hooks/useUsers";
import { PASSWORD_HINT } from "../constants";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

interface ChangePasswordFormProps {
  userId: string;
}

export function ChangePasswordForm({ userId }: ChangePasswordFormProps) {
  const changePassword = useChangePassword(userId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    try {
      await changePassword.mutateAsync(data);
      toast.success("Contraseña actualizada exitosamente");
      reset();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al cambiar la contraseña"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Cambiar contraseña
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword" className="mb-1">Contraseña actual</Label>
            <PasswordInput id="currentPassword" autoComplete="current-password" {...register("currentPassword")} error={!!errors.currentPassword} />
            {errors.currentPassword && (
              <p className="text-sm text-destructive mt-1">{errors.currentPassword.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="newPassword" className="mb-1">Nueva contraseña</Label>
            <PasswordInput id="newPassword" autoComplete="new-password" {...register("newPassword")} error={!!errors.newPassword} />
            {errors.newPassword && (
              <p className="text-sm text-destructive mt-1">{errors.newPassword.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{PASSWORD_HINT}</p>
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Cambiando\u2026" : "Cambiar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
