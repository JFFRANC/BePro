import { QueryClientProvider, QueryErrorResetBoundary } from "@tanstack/react-query";
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
import { AbilityProvider } from "@/components/ability-provider";
import { defineAbilityFor } from "@/lib/ability";
import { AppShellLayout } from "@/components/layout";
import { PreviewPage } from "@/modules/design-system/pages/PreviewPage";
import { UsersPage } from "@/modules/users/pages/UsersPage";
import { UserDetailPage } from "@/modules/users/pages/UserDetailPage";
import { ForcePasswordChangePage } from "@/modules/users/pages/ForcePasswordChangePage";
import { ClientsPage } from "@/modules/clients/pages/ClientsPage";
import { ClientDetailPage } from "@/modules/clients/pages/ClientDetailPage";
import { useLocation } from "react-router-dom";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

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

  // Forced password change — redirect to change-password unless already there
  if (user?.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  const ability = defineAbilityFor({ role: user!.role, id: user!.id });

  return (
    <AbilityProvider ability={ability}>
      {children}
    </AbilityProvider>
  );
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
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset}>
                  <OfflineBanner />
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/design-system" element={<PreviewPage />} />
                    <Route
                      path="/change-password"
                      element={
                        <RequireAuth>
                          <ForcePasswordChangePage />
                        </RequireAuth>
                      }
                    />
                    <Route path="/403" element={<ErrorPage code={403} />} />
                    <Route
                      element={
                        <RequireAuth>
                          <AppShellLayout />
                        </RequireAuth>
                      }
                    >
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/users/:id" element={<UserDetailPage />} />
                      <Route path="/clients" element={<ClientsPage />} />
                      <Route path="/clients/:id" element={<ClientDetailPage />} />
                    </Route>
                    <Route path="*" element={<ErrorPage code={404} />} />
                  </Routes>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </BrowserRouter>
          <Toaster />
        </ConfirmDialogProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
