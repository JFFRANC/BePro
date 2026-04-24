import { Navigate } from "react-router-dom";
import { LoginForm } from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";

// Entrance choreography per specs/009-ui-visual-refresh/contracts/motion.md:
// stagger 80ms, per-element duration 180ms, cumulative <= 500ms.
// Reduced-motion: class motion-reduce:animate-none cancela las
// transformaciones (el contenido queda visible desde el frame 0).
const STAGGER_CLASSES =
  "animate-in fade-in-0 slide-in-from-top-1 duration-[180ms] ease-out motion-reduce:animate-none motion-reduce:transform-none motion-reduce:opacity-100";

export function LoginPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      data-testid="login-page"
    >
      <div className="text-center space-y-6">
        <div>
          <h1
            className={`text-3xl font-bold text-foreground ${STAGGER_CLASSES}`}
            style={{ animationDelay: "0ms", animationFillMode: "both" }}
            data-stagger-step="0"
          >
            BePro
          </h1>
          <p
            className={`text-sm text-muted-foreground mt-1 ${STAGGER_CLASSES}`}
            style={{ animationDelay: "80ms", animationFillMode: "both" }}
            data-stagger-step="1"
          >
            Sistema de Reclutamiento y Selección
          </p>
        </div>
        <div
          className={STAGGER_CLASSES}
          style={{ animationDelay: "160ms", animationFillMode: "both" }}
          data-stagger-step="2"
        >
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
