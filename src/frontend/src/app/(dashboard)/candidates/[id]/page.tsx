"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCandidate, useUpdateCandidateStatus } from "@/hooks/useCandidates";
import { useCreatePlacement } from "@/hooks/usePlacements";
import { useAuthStore } from "@/store/authStore";
import StatusBadge from "@/components/candidates/StatusBadge";
import UpdateStatusDialog from "@/components/candidates/UpdateStatusDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CandidateStatus, RejectionCategory } from "@/types/candidate";

const REJECTION_LABELS: Record<string, string> = {
  interview: "Por entrevista",
  medical_exam: "Por examen médico",
  background_check: "Por investigación laboral",
  documentation: "Por documentación",
  no_show: "No se presentó a inducción",
  salary: "Por salario",
  schedule: "Por horarios/turnos",
  transportation: "Por transporte",
  personal_decision: "Decisión personal",
  other: "Otro",
};

export default function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canChangeStatus =
    user?.role === "admin" ||
    user?.role === "manager" ||
    user?.role === "account_executive";

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [hireDate, setHireDate] = useState("");
  const [guaranteeEndDate, setGuaranteeEndDate] = useState("");

  const { data: candidate, isLoading } = useCandidate(id);
  const updateStatus = useUpdateCandidateStatus(id, candidate?.clientId ?? "");
  const createPlacement = useCreatePlacement();

  const canCreatePlacement =
    (user?.role === "admin" || user?.role === "manager" || user?.role === "account_executive") &&
    candidate?.status === "approved";

  const handleCreatePlacement = async () => {
    if (!hireDate) return;
    try {
      await createPlacement.mutateAsync({
        candidateId: id,
        hireDate,
        guaranteeEndDate: guaranteeEndDate || undefined,
      });
      toast.success("Colocación creada exitosamente");
      router.push("/placements");
    } catch {
      toast.error("Error al crear colocación");
    }
  };

  const handleStatusChange = async (
    status: CandidateStatus,
    rejectionCategory?: RejectionCategory,
    rejectionDetails?: string
  ) => {
    try {
      await updateStatus.mutateAsync({ status, rejectionCategory, rejectionDetails });
      toast.success("Estatus actualizado");
      setStatusDialogOpen(false);
    } catch {
      toast.error("Error al actualizar estatus");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!candidate)
    return <p className="text-muted-foreground">Candidato no encontrado</p>;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{candidate.fullName}</h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={candidate.status} />
          </div>
        </div>
        {canChangeStatus && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStatusDialogOpen(true)}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Cambiar estatus
          </Button>
        )}
      </div>

      {/* Datos principales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del candidato</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Teléfono", value: candidate.phone },
            { label: "Cliente", value: candidate.clientName },
            { label: "Reclutador", value: candidate.recruiterFullName },
            { label: "Líder", value: candidate.leaderFullName },
            {
              label: "Fecha entrevista",
              value: formatDate(candidate.interviewDate),
            },
            { label: "Hora entrevista", value: candidate.interviewTime },
            { label: "Puesto", value: candidate.position },
            { label: "Municipio", value: candidate.municipality },
            { label: "Edad", value: candidate.age?.toString() },
            { label: "Turno", value: candidate.shift },
            { label: "Planta", value: candidate.plant },
            { label: "Punto de entrevista", value: candidate.interviewPoint },
          ]
            .filter((f) => f.value)
            .map((f) => (
              <div key={f.label}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {f.label}
                </p>
                <p className="mt-0.5 font-medium">{f.value}</p>
              </div>
            ))}

          {candidate.comments && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Comentarios
              </p>
              <p className="mt-0.5">{candidate.comments}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Motivo de rechazo */}
      {(candidate.rejectionCategory || candidate.rejectionDetails) && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-base text-red-800">
              Motivo de {candidate.status === "rejected" ? "rechazo" : "declinación"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {candidate.rejectionCategory && (
              <p className="font-medium text-red-900">
                {REJECTION_LABELS[candidate.rejectionCategory] ?? candidate.rejectionCategory}
              </p>
            )}
            {candidate.rejectionDetails && (
              <p className="text-sm text-red-800">{candidate.rejectionDetails}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Crear colocación */}
      {canCreatePlacement && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-base text-green-800">Crear colocación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-green-900">Fecha de ingreso *</Label>
                <Input
                  type="date"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-green-900">Fin de garantía</Label>
                <Input
                  type="date"
                  value={guaranteeEndDate}
                  onChange={(e) => setGuaranteeEndDate(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>
            <Button
              onClick={handleCreatePlacement}
              disabled={!hireDate || createPlacement.isPending}
              className="bg-green-700 hover:bg-green-800 text-white"
            >
              Crear colocación
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Registro */}
      <p className="text-xs text-muted-foreground">
        Registrado el {formatDate(candidate.createdAt)}
      </p>

      {/* Dialog cambio de estatus */}
      {candidate && (
        <UpdateStatusDialog
          open={statusDialogOpen}
          onOpenChange={setStatusDialogOpen}
          currentStatus={candidate.status}
          onConfirm={handleStatusChange}
          isLoading={updateStatus.isPending}
        />
      )}
    </div>
  );
}
