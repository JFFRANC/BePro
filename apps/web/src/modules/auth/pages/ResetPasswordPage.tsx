import { ResetPasswordForm } from "../components/ResetPasswordForm";

export function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">BePro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Establece tu nueva contraseña
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
