import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@bepro/shared";
import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useResetPassword } from "../hooks/useUsers";
import { PASSWORD_HINT } from "../constants";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";

interface ResetPasswordDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: ResetPasswordDialogProps) {
  const resetPassword = useResetPassword(userId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordFormValues) => {
    try {
      await resetPassword.mutateAsync(data);
      toast.success(`Contraseña de ${userName} restablecida exitosamente`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al restablecer la contraseña"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Asignar una nueva contraseña a {userName}. El usuario deberá cambiarla en su próximo inicio de sesión.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="resetNewPassword" className="mb-1">Nueva contraseña</Label>
            <PasswordInput id="resetNewPassword" autoComplete="new-password" {...register("newPassword")} error={!!errors.newPassword} />
            {errors.newPassword && (
              <p className="text-sm text-destructive mt-1">{errors.newPassword.message}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{PASSWORD_HINT}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Restableciendo\u2026" : "Restablecer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
