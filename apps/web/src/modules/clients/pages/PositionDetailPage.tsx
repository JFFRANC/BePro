// 011-puestos-profile-docs / US1+US2+US5 — detalle de un puesto.
//
// - Recruiter: vista read-only del perfil + descarga de documentos activos.
// - Admin/manager/AE: form editable + slots de documentos (subir/reemplazar/eliminar).
// - Admin: ve además el panel "Versiones" con archivados.

import { useParams, useNavigate } from "react-router-dom";
import {
  usePosition,
  useClient,
} from "../hooks/useClients";
import { updatePosition } from "../services/clientService";
import { PositionForm } from "../components/PositionForm";
import { PositionDocumentSlot } from "../components/PositionDocumentSlot";
import { PositionVersionsPanel } from "../components/PositionVersionsPanel";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAppAbility } from "@/components/ability-provider";
import { useQueryClient } from "@tanstack/react-query";
import { CLIENT_KEYS } from "../hooks/useClients";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/error-utils";
import { ArrowLeft, Download } from "lucide-react";
import type { CreatePositionProfileInput, PositionDocumentType } from "@bepro/shared";
import { downloadPositionDocument } from "../services/clientService";

const FIELD_LABELS: Record<string, string> = {
  vacancies: "Vacantes",
  workLocation: "Lugar de trabajo",
  ageMin: "Edad mínima",
  ageMax: "Edad máxima",
  gender: "Género",
  civilStatus: "Estado civil",
  educationLevel: "Escolaridad",
  experienceText: "Experiencia",
  salaryAmount: "Salario base",
  salaryCurrency: "Moneda",
  paymentFrequency: "Frecuencia de pago",
  salaryNotes: "Notas de compensación",
  benefits: "Prestaciones",
  scheduleText: "Horario",
  workDays: "Días de trabajo",
  shift: "Turno",
  requiredDocuments: "Documentación requerida",
  responsibilities: "Funciones",
  faq: "Preguntas frecuentes",
};

function renderValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  return String(v);
}

export function PositionDetailPage() {
  const { id: clientId, posId } = useParams<{ id: string; posId: string }>();
  const navigate = useNavigate();
  const ability = useAppAbility();
  const queryClient = useQueryClient();

  const canEdit = ability.can("update", "Position");

  const { data: client } = useClient(clientId!);
  const { data: position, isLoading } = usePosition(clientId!, posId);

  if (isLoading || !position) {
    return (
      <div className="page-container py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  async function handleSubmit(values: CreatePositionProfileInput) {
    try {
      await updatePosition(clientId!, posId!, values);
      toast.success("Puesto actualizado");
      queryClient.invalidateQueries({
        queryKey: [...CLIENT_KEYS.positions(clientId!), "detail", posId],
      });
      queryClient.invalidateQueries({
        queryKey: CLIENT_KEYS.positions(clientId!),
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al guardar"));
    }
  }

  function handleDocDownload(type: PositionDocumentType) {
    const docId = position!.documents?.[type]?.id;
    if (!docId) return;
    const name = type === "contract" ? "contrato" : "pase-de-visita";
    downloadPositionDocument(clientId!, posId!, docId, `${name}.pdf`).catch(
      (err) => toast.error(getApiErrorMessage(err, "Error al descargar")),
    );
  }

  return (
    <div className="page-container py-8 space-y-6">
      <PageHeader
        title={position.name}
        description={client?.name ?? undefined}
        action={
          position.isActive ? (
            <Badge variant="default" className="bg-success text-success-foreground">
              Activo
            </Badge>
          ) : (
            <Badge variant="secondary">Inactivo</Badge>
          )
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => navigate(`/clients/${clientId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {client?.name ?? "Cliente"}
        </Button>
      </PageHeader>

      {/* Read-only para recruiter; editable para admin/manager/AE */}
      {canEdit ? (
        <PositionForm defaultValues={position} onSubmit={handleSubmit} />
      ) : (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Perfil del puesto</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {Object.keys(FIELD_LABELS).map((key) => {
              const value = (position as unknown as Record<string, unknown>)[key];
              return (
                <div key={key} className="border rounded-lg p-3">
                  <dt className="text-muted-foreground">{FIELD_LABELS[key]}</dt>
                  <dd className="font-medium whitespace-pre-wrap">
                    {renderValue(value)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {/* Documentos del puesto (US2) */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Documentos del puesto</h3>
        {canEdit ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PositionDocumentSlot
              clientId={clientId!}
              positionId={posId!}
              type="contract"
              position={position}
            />
            <PositionDocumentSlot
              clientId={clientId!}
              positionId={posId!}
              type="pase_visita"
              position={position}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(["contract", "pase_visita"] as const).map((type) => {
              const docId = position.documents?.[type]?.id;
              return (
                <div
                  key={type}
                  className="border rounded-lg p-4 flex items-center justify-between"
                >
                  <span className="font-medium">
                    {type === "contract" ? "Contrato" : "Pase de visita"}
                  </span>
                  {docId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDocDownload(type)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Descargar
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Sin documento
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Versiones (admin only — FR-018) */}
      <PositionVersionsPanel clientId={clientId!} positionId={posId!} />
    </div>
  );
}
