import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useClient, useUpdateClient } from "../hooks/useClients";
import { ClientForm } from "../components/ClientForm";
import { FormConfigEditor } from "../components/FormConfigEditor";
import { FormConfigFieldsEditor } from "../components/FormConfigFieldsEditor";
// 008-ux-roles-refinements / US5 — AssignmentTable replaces the old
// AssignmentManager (single-select + "Asignar" button) with a searchable
// checkbox table that saves the full diff in one batch call.
import { AssignmentTable } from "../components/AssignmentTable";
import { ContactDirectory } from "../components/ContactDirectory";
import { PositionList } from "../components/PositionList";
// 011-puestos-profile-docs / US3 — `DocumentManager` y la pestaña "Documentos"
// se eliminaron a nivel de cliente; los documentos ahora viven por puesto.
import { LocationMap } from "../components/LocationMap";
import { CopyAddressButton } from "../components/CopyAddressButton";
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
import { ArrowLeft, MapPin, Pencil, Power } from "lucide-react";

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const ability = useAppAbility();
  const { data: client, isLoading } = useClient(id!);
  const updateClient = useUpdateClient(id!);
  const confirm = useConfirm();
  const [showEditDialog, setShowEditDialog] = useState(false);
  // 012-client-detail-ux / US3 — defensive redirect: si la URL trae el
  // segmento legacy `/config`, lo convertimos a `/clients/:id` (sin segmento
  // por pestaña, ver research §R-03) y forzamos la pestaña "form".
  const initialTab = location.pathname.endsWith("/config") ? "form" : "contacts";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  useEffect(() => {
    if (id && location.pathname.endsWith("/config")) {
      navigate(`/clients/${id}`, { replace: true });
      setActiveTab("form");
    }
  }, [id, location.pathname, navigate]);

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

  const hasCoords = client.latitude != null && client.longitude != null;
  const hasDescription = !!client.description?.trim();

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

      {/* 012 / US2 — 2-column layout en md+ (mapa izquierda, info derecha);
          single-column abajo de md (orden: descripción → info → mapa al final). */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Mapa + dirección + copiar — orden visual en mobile va al final */}
        <section
          aria-label="Ubicación"
          className="order-last md:order-none space-y-3"
        >
          <h3 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Ubicación
          </h3>
          {hasCoords ? (
            <div className="overflow-hidden rounded-lg border h-64">
              <LocationMap
                latitude={client.latitude!}
                longitude={client.longitude!}
                address={client.address ?? undefined}
                readOnly
              />
            </div>
          ) : (
            <div className="h-64 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
              Sin ubicación capturada
            </div>
          )}
          {client.address && (
            <p className="text-sm text-muted-foreground">{client.address}</p>
          )}
          <CopyAddressButton address={client.address} />
        </section>

        {/* Descripción + info general */}
        <div className="space-y-4">
          {/* US1 — Bloque descripción: oculto si null/empty; whitespace-pre-line
              preserva \n y muestra markdown literal. */}
          {hasDescription && (
            <section aria-label="Descripción" className="space-y-2">
              <h3 className="text-sm font-medium">Descripción</h3>
              <p
                data-testid="client-description"
                className="text-sm text-foreground whitespace-pre-line"
              >
                {client.description}
              </p>
            </section>
          )}

          <section aria-label="Información general" className="space-y-2">
            <h3 className="text-sm font-medium">Información general</h3>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              {client.email && (
                <div className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">Correo</dt>
                  <dd>{client.email}</dd>
                </div>
              )}
              {client.phone && (
                <div className="flex flex-col">
                  <dt className="text-xs text-muted-foreground">Teléfono</dt>
                  <dd>{client.phone}</dd>
                </div>
              )}
              {!client.email && !client.phone && (
                <p className="text-xs text-muted-foreground">
                  No se han capturado datos de contacto general.
                </p>
              )}
            </dl>
          </section>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="positions">Puestos</TabsTrigger>
          {isAdmin && <TabsTrigger value="assignments">Asignaciones</TabsTrigger>}
          {/* 012 / US3 — "Configuración" → "Formulario" (value=`form`). */}
          {isAdmin && <TabsTrigger value="form">Formulario</TabsTrigger>}
        </TabsList>

        <TabsContent value="contacts" className="mt-4">
          <ContactDirectory clientId={client.id} readOnly={!canWrite} />
        </TabsContent>

        <TabsContent value="positions" className="mt-4">
          <PositionList clientId={client.id} readOnly={!canWrite} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="assignments" className="mt-4">
            <AssignmentTable clientId={client.id} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="form" className="mt-4 space-y-6">
            <FormConfigEditor client={client} />
            {/* 008-ux-roles-refinements / US6 — admin-managed custom fields. */}
            <FormConfigFieldsEditor client={client} />
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
