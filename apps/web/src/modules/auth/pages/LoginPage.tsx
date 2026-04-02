import { Navigate } from "react-router-dom";
import { LoginForm } from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">BePro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sistema de Reclutamiento y Selección
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
