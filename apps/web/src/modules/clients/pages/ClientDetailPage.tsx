import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useClient, useUpdateClient } from "../hooks/useClients";
import { ClientForm } from "../components/ClientForm";
import { FormConfigEditor } from "../components/FormConfigEditor";
import { AssignmentManager } from "../components/AssignmentManager";
import { ContactDirectory } from "../components/ContactDirectory";
import { PositionList } from "../components/PositionList";
import { DocumentManager } from "../components/DocumentManager";
import { LocationMap } from "../components/LocationMap";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleGate } from "@/components/role-gate";
import { useAppAbility } from "@/components/ability-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Power } from "lucide-react";

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ability = useAppAbility();
  const { data: client, isLoading } = useClient(id!);
  const updateClient = useUpdateClient(id!);
  const confirm = useConfirm();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const isAdmin = ability.can("manage", "all");
  const canWrite = ability.can("update", "Client");

  const handleToggleActive = async () => {
    if (!client) return;
    const newStatus = !client.isActive;
    const confirmed = await confirm({
      title: newStatus ? "Activar cliente" : "Desactivar cliente",
      description: newStatus
        ? `¿Estás seguro de activar a "${client.name}"? Aparecerá en búsquedas y procesos.`
        : `¿Estás seguro de desactivar a "${client.name}"? No aparecerá en búsquedas ni procesos.`,
      confirmLabel: newStatus ? "Activar" : "Desactivar",
      variant: newStatus ? "default" : "destructive",
      icon: Power,
    });
    if (!confirmed) return;
    try {
      await updateClient.mutateAsync({ isActive: newStatus });
      toast.success(newStatus ? "Cliente activado" : "Cliente desactivado");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al cambiar el estado del cliente"));
    }
  };

  if (isLoading) {
    return (
      <div className="page-container py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page-container py-8">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="link" onClick={() => navigate("/clients")}>
          Volver a clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="page-container py-8 space-y-6">
      <PageHeader
        title={client.name}
        description={client.address || undefined}
        action={
          <div className="flex items-center gap-2">
            {client.isActive ? (
              <Badge variant="default" className="bg-success text-success-foreground">Activo</Badge>
            ) : (
              <Badge variant="secondary">Inactivo</Badge>
            )}
            <RoleGate action="update" subject="Client">
              <Button
                variant={client.isActive ? "outline" : "default"}
                size="sm"
                onClick={handleToggleActive}
                disabled={updateClient.isPending}
              >
                <Power className="h-4 w-4 mr-2" />
                {client.isActive ? "Desactivar" : "Activar"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </RoleGate>
          </div>
        }
      >
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/clients")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Clientes
        </Button>
      </PageHeader>

      {/* Ubicación */}
      {(client.address || client.latitude != null || client.longitude != null) && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Ubicación</h3>
          {client.address && (
            <p className="text-sm text-muted-foreground">{client.address}</p>
          )}
          {client.latitude != null && client.longitude != null && (
            <LocationMap
              latitude={client.latitude}
              longitude={client.longitude}
              address={client.address ?? undefined}
              readOnly
            />
          )}
        </div>
      )}

      <Tabs defaultValue="contacts">
        <TabsList>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="positions">Puestos</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          {isAdmin && <TabsTrigger value="assignments">Asignaciones</TabsTrigger>}
          {isAdmin && <TabsTrigger value="config">Configuración</TabsTrigger>}
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          <ContactDirectory clientId={client.id} readOnly={!canWrite} />
        </TabsContent>

        <TabsContent value="positions" className="mt-4">
          <PositionList clientId={client.id} readOnly={!canWrite} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentManager clientId={client.id} readOnly={!canWrite} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="assignments" className="mt-4">
            <AssignmentManager clientId={client.id} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="config" className="mt-4">
            <FormConfigEditor client={client} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <ClientForm
            client={client}
            onSuccess={() => setShowEditDialog(false)}
            onCancel={() => setShowEditDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
