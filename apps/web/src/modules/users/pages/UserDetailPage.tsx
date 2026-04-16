import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser, useDeactivateUser, useReactivateUser } from "../hooks/useUsers";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useConfirm } from "@/components/confirm-dialog";
import { UserAvatar } from "../components/UserAvatar";
import { UserDetail } from "../components/UserDetail";
import { ChangePasswordForm } from "../components/ChangePasswordForm";
import { ResetPasswordDialog } from "../components/ResetPasswordDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Clock,
  Calendar,
  UserX,
  UserCheck,
  KeyRound,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/error-utils";
import { ROLE_LABELS } from "../constants";

function DetailSkeleton() {
  return (
    <div className="page-container py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="size-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading } = useUser(id!);
  const { user: currentUser } = useAuth();
  const confirm = useConfirm();
  const deactivateUser = useDeactivateUser();
  const reactivateUser = useReactivateUser();
  const [showResetPassword, setShowResetPassword] = useState(false);

  const isAdmin = currentUser?.role === "admin";
  const isSelf = currentUser?.id === id;

  if (isLoading) return <DetailSkeleton />;

  if (!user) {
    return (
      <div className="page-container py-8 text-center">
        <p className="text-muted-foreground">Usuario no encontrado</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/users")}>
          Volver a usuarios
        </Button>
      </div>
    );
  }

  const handleDeactivate = async () => {
    const confirmed = await confirm({
      title: "Desactivar usuario",
      description: `¿Estás seguro de que deseas desactivar a ${user.firstName} ${user.lastName}? Se revocarán todas sus sesiones activas.`,
      confirmLabel: "Desactivar",
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await deactivateUser.mutateAsync(user.id);
      toast.success("Usuario desactivado exitosamente");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al desactivar el usuario"));
    }
  };

  const handleReactivate = async () => {
    const confirmed = await confirm({
      title: "Reactivar usuario",
      description: `¿Deseas reactivar a ${user.firstName} ${user.lastName}?`,
      confirmLabel: "Reactivar",
    });
    if (!confirmed) return;
    try {
      await reactivateUser.mutateAsync(user.id);
      toast.success("Usuario reactivado exitosamente");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al reactivar el usuario"));
    }
  };

  return (
    <div className="page-container py-8 space-y-8">
      {/* Back + Profile Header */}
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/users")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Usuarios
        </Button>

        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            <UserAvatar
              firstName={user.firstName}
              lastName={user.lastName}
              role={user.role}
              isActive={user.isActive}
              size="xl"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="!text-2xl text-balance">
                  {user.firstName} {user.lastName}
                </h1>
                {!user.isActive && (
                  <Badge variant="secondary">Inactivo</Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5">{user.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline">
                  <Shield className="h-3 w-3 mr-1" />
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
                {user.isFreelancer && (
                  <Badge variant="outline">Freelancer</Badge>
                )}
                {user.mustChangePassword && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Debe cambiar contraseña
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {isAdmin && !isSelf && (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetPassword(true)}
              >
                <KeyRound className="h-4 w-4 mr-1" />
                Restablecer contraseña
              </Button>
              {user.isActive ? (
                <Button variant="destructive" size="sm" onClick={handleDeactivate}>
                  <UserX className="h-4 w-4 mr-1" />
                  Desactivar
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={handleReactivate}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  Reactivar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList variant="line">
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <div className="max-w-2xl">
            <UserDetail user={user} />
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <div className="max-w-md">
            {isSelf ? (
              <ChangePasswordForm userId={user.id} />
            ) : isAdmin ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contraseña del usuario</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Como administrador, puedes restablecer la contraseña de este usuario.
                    Se le pedirá que la cambie en su próximo inicio de sesión.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShowResetPassword(true)}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Restablecer contraseña
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No tienes permisos para gestionar la seguridad de este usuario.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <div className="max-w-md">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actividad reciente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Último acceso</p>
                    <p className="text-sm text-muted-foreground">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString("es-MX")
                        : "Nunca ha iniciado sesión"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Fecha de creación</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleString("es-MX")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Reset Password Dialog */}
      {isAdmin && !isSelf && (
        <ResetPasswordDialog
          userId={user.id}
          userName={`${user.firstName} ${user.lastName}`}
          open={showResetPassword}
          onOpenChange={setShowResetPassword}
        />
      )}
    </div>
  );
}
