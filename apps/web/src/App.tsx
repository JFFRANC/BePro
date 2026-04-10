import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { ErrorPage } from "@/components/error-page";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { PreviewPage } from "@/modules/design-system/pages/PreviewPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">BePro</h1>
        <p className="text-muted-foreground">
          Bienvenido, {user?.firstName} {user?.lastName}
        </p>
        <p className="text-sm text-muted-foreground">
          Rol: {user?.role}
        </p>
        <button
          onClick={logout}
          className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider theme={null}>
      <QueryClientProvider client={queryClient}>
        <ConfirmDialogProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <OfflineBanner />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/design-system" element={<PreviewPage />} />
                <Route path="/403" element={<ErrorPage code={403} />} />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <DashboardPage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<ErrorPage code={404} />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
          <Toaster />
        </ConfirmDialogProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
