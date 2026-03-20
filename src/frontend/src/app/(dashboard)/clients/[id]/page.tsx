"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClient, useClientAssignments, useUpdateClient } from "@/hooks/useClients";
import { useUsers } from "@/hooks/useUsers";
import { useAuthStore } from "@/store/authStore";
import ClientForm from "@/components/clients/ClientForm";
import FormConfigToggle from "@/components/clients/FormConfigToggle";
import { clientService } from "@/services/clientService";
import { useQueryClient } from "@tanstack/react-query";
import { CLIENT_KEYS } from "@/hooks/useClients";
import type { ClientFormValues } from "@/lib/schemas/client";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Gerente",
  account_executive: "Ejecutivo de cuenta",
  recruiter: "Reclutador",
};

type Tab = "info" | "config" | "users";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "admin";
  const isAdminOrManager =
    user?.role === "admin" || user?.role === "manager";
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("info");
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: client, isLoading } = useClient(id);
  const { data: assignments } = useClientAssignments(id);
  const { data: users } = useUsers();
  const updateClient = useUpdateClient(id);

  const handleEdit = async (data: ClientFormValues) => {
    try {
      await updateClient.mutateAsync(data);
      toast.success("Cliente actualizado");
      setEditOpen(false);
    } catch {
      toast.error("Error al actualizar cliente");
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setAssigning(true);
    try {
      await clientService.assignUser(id, { userId: selectedUserId });
      qc.invalidateQueries({ queryKey: CLIENT_KEYS.assignments(id) });
      toast.success("Usuario asignado");
      setAssignOpen(false);
      setSelectedUserId("");
    } catch {
      toast.error("Error al asignar usuario");
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setRemovingId(userId);
    try {
      await clientService.removeAssignment(id, userId);
      qc.invalidateQueries({ queryKey: CLIENT_KEYS.assignments(id) });
      toast.success("Asignación eliminada");
    } catch {
      toast.error("Error al eliminar asignación");
    } finally {
      setRemovingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!client) return <p className="text-muted-foreground">Cliente no encontrado</p>;

  const assignedUserIds = new Set(assignments?.map((a) => a.userId) ?? []);
  const availableUsers = users?.filter(
    (u) => !assignedUserIds.has(u.id) && u.isActive
  ) ?? [];

  const TABS: { key: Tab; label: string }[] = [
    { key: "info", label: "Información" },
    { key: "config", label: "Configuración de formulario" },
    ...(isAdminOrManager ? [{ key: "users" as Tab, label: "Usuarios asignados" }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          {!client.isActive && (
            <Badge variant="secondary" className="mt-1">Inactivo</Badge>
          )}
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Editar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Información */}
      {tab === "info" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Nombre</p>
              <p className="font-medium mt-0.5">{client.name}</p>
            </div>
            {client.contactInfo && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Contacto</p>
                <p className="mt-0.5">{client.contactInfo}</p>
              </div>
            )}
            {client.address && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Dirección</p>
                <p className="mt-0.5">{client.address}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Configuración de formulario */}
      {tab === "config" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campos del formulario</CardTitle>
          </CardHeader>
          <CardContent>
            <FormConfigToggle client={client} readOnly={!isAdmin} />
          </CardContent>
        </Card>
      )}

      {/* Tab: Usuarios asignados */}
      {tab === "users" && isAdminOrManager && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAssignOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Asignar usuario
            </Button>
          </div>
          {!assignments?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay usuarios asignados a este cliente
            </p>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{a.userFullName}</p>
                      <p className="text-sm text-muted-foreground">
                        {ROLE_LABELS[a.userRole] ?? a.userRole}
                        {a.leaderFullName && ` · Líder: ${a.leaderFullName}`}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(a.userId)}
                        disabled={removingId === a.userId}
                      >
                        {removingId === a.userId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialog: Editar cliente */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            defaultValues={client}
            onSubmit={handleEdit}
            isLoading={updateClient.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Asignar usuario */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              <option value="">Selecciona un usuario</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({ROLE_LABELS[u.role] ?? u.role})
                </option>
              ))}
            </select>
            <Button
              onClick={handleAssign}
              disabled={!selectedUserId || assigning}
              className="w-full"
            >
              {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Asignar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
