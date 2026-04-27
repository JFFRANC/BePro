// 007-candidates-module — detalle del candidato (US2 + US3 + US4 + US6 polish).
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useCandidate } from "../hooks/useCandidates";
import { StatusBadge } from "../components/StatusBadge";
import { StatusTransitionDialog } from "../components/StatusTransitionDialog";
import { ReactivateDialog } from "../components/ReactivateDialog";
import { AttachmentList } from "../components/AttachmentList";
import { EditPiiDialog } from "../components/EditPiiDialog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRightLeft, RotateCw, Pencil } from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  isNegativeTerminal,
  statusLabel,
  type CandidateStatus,
} from "@bepro/shared";

export function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data, isLoading, error } = useCandidate(id);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="page-container py-8 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="page-container py-8 space-y-4">
        <PageHeader title="Candidato no encontrado" />
        <Link to="/candidates">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Volver al listado
          </Button>
        </Link>
      </div>
    );
  }

  const c = data.candidate;
  const role = user?.role;

  // Reglas locales para mostrar/ocultar acciones (FR-032/033/034 / FR-038a / FR-011b).
  const canTransition =
    role === "manager" || role === "admin" || role === "account_executive";
  const canReactivate =
    role === "admin" &&
    !c.is_active &&
    isNegativeTerminal(c.status as CandidateStatus);
  const canEditPii =
    role === "manager" ||
    role === "admin" ||
    role === "account_executive" ||
    (role === "recruiter" &&
      c.registering_user.id === user?.id &&
      c.status === "registered");
  const canEditAttachments = canEditPii;
  const canSeeObsolete = role === "manager" || role === "admin";

  return (
    <div className="page-container py-8 space-y-6">
      <Link
        to="/candidates"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Volver al listado
      </Link>

      <PageHeader
        title={`${c.first_name} ${c.last_name}`}
        description={`${c.client.name} · ${c.source}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status as CandidateStatus} />
            {canEditPii && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Editar datos
              </Button>
            )}
            {canTransition && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTransitionOpen(true)}
              >
                <ArrowRightLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Cambiar estado
              </Button>
            )}
            {canReactivate && (
              <Button
                variant="warning"
                size="sm"
                onClick={() => setReactivateOpen(true)}
              >
                <RotateCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Reactivar
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feature 009 follow-up: hero card con spotlight (variant=feature)
            para dar enfasis visual a los datos principales del candidato. */}
        <Card variant="feature" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Datos del candidato</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <DataRow label="Teléfono" value={c.phone} mono />
              <DataRow label="Correo" value={c.email} />
              <DataRow
                label="Puesto actual"
                value={c.current_position ?? "—"}
              />
              <DataRow
                label="Reclutador"
                value={c.registering_user.display_name}
              />
              <DataRow label="Activo" value={c.is_active ? "Sí" : "No"} />
              <DataRow
                label="Aviso de privacidad"
                value={`v${data.privacy_notice?.version ?? "—"}${
                  data.privacy_notice
                    ? ` (${new Date(
                        data.privacy_notice.effective_from,
                      ).toLocaleDateString("es-MX")})`
                    : ""
                }`}
              />
            </dl>

            {Object.keys(c.additional_fields ?? {}).length > 0 ? (
              <div className="mt-6 pt-4 border-t">
                <p className="text-sm font-medium mb-3">Campos adicionales</p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {Object.entries(c.additional_fields ?? {}).map(([k, v]) => (
                    <DataRow
                      key={k}
                      label={prettifyKey(k)}
                      value={String(v ?? "—")}
                    />
                  ))}
                </dl>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.status_history.length === 0 ? (
              <p className="text-muted-foreground">Sin eventos registrados.</p>
            ) : (
              <ol className="space-y-3">
                {data.status_history.map((ev) => (
                  <HistoryItem key={ev.id} event={ev} />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <AttachmentList
        candidateId={c.id}
        canEdit={canEditAttachments}
        canSeeObsolete={canSeeObsolete}
      />

      {canTransition && (
        <StatusTransitionDialog
          open={transitionOpen}
          onOpenChange={setTransitionOpen}
          candidateId={c.id}
          currentStatus={c.status as CandidateStatus}
        />
      )}
      {role === "admin" && (
        <ReactivateDialog
          open={reactivateOpen}
          onOpenChange={setReactivateOpen}
          candidateId={c.id}
        />
      )}
      {canEditPii && (
        <EditPiiDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          candidate={c}
        />
      )}
    </div>
  );
}

function DataRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-words ${mono ? "font-mono" : ""}`}
        style={mono ? { fontVariantNumeric: "tabular-nums" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

interface HistoryEvent {
  id: string;
  actor_id: string;
  created_at: string;
  old_values: unknown;
  new_values: unknown;
}

function HistoryItem({ event }: { event: HistoryEvent }) {
  const summary = describeEvent(event);
  return (
    <li className="border-l-2 pl-3 py-1">
      <p
        className="text-xs text-muted-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {new Date(event.created_at).toLocaleString("es-MX", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <p className="text-sm">{summary.label}</p>
      {summary.detail && (
        <p className="text-xs text-muted-foreground">{summary.detail}</p>
      )}
    </li>
  );
}

function describeEvent(ev: HistoryEvent): { label: string; detail?: string } {
  const newValues = (ev.new_values ?? {}) as Record<string, unknown>;
  const oldValues = (ev.old_values ?? {}) as Record<string, unknown>;

  if ("status" in newValues && "status" in oldValues) {
    const from = oldValues.status as CandidateStatus;
    const to = newValues.status as CandidateStatus;
    return {
      label: `${statusLabel(from)} → ${statusLabel(to)}`,
      detail:
        typeof newValues.note === "string" && newValues.note
          ? `Nota: ${newValues.note}`
          : undefined,
    };
  }
  if ("is_active" in newValues && newValues.is_active === true) {
    return {
      label: "Reactivado",
      detail:
        typeof newValues.note === "string" && newValues.note
          ? `Nota: ${newValues.note}`
          : undefined,
    };
  }
  if ("privacy_notice_id" in newValues) {
    return { label: "Candidato registrado" };
  }
  const fields = Object.keys(newValues);
  if (fields.length === 1) {
    return { label: `Editó ${prettifyKey(fields[0])}` };
  }
  if ("attachment_id" in newValues) {
    return { label: "Adjuntó archivo" };
  }
  if ("is_obsolete" in newValues && newValues.is_obsolete === true) {
    return { label: "Marcó adjunto como obsoleto" };
  }
  return { label: "Evento" };
}

function prettifyKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
