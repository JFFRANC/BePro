"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CandidateStatus, RejectionCategory } from "@/types/candidate";

const NEXT_STATUSES: Record<CandidateStatus, CandidateStatus[]> = {
  registered: ["interview_scheduled", "no_show", "discarded"],
  interview_scheduled: ["attended", "no_show", "discarded"],
  attended: ["pending", "approved", "rejected", "declined"],
  no_show: ["discarded"],
  pending: ["approved", "rejected", "declined", "discarded"],
  approved: [],
  rejected: [],
  declined: [],
  discarded: [],
  hired: ["in_guarantee"],
  in_guarantee: ["guarantee_met", "guarantee_failed"],
  guarantee_met: [],
  guarantee_failed: ["replacement"],
  replacement: [],
};

const STATUS_LABELS: Record<CandidateStatus, string> = {
  registered: "Registrado",
  interview_scheduled: "Cita agendada",
  attended: "Asistió",
  no_show: "No se presentó",
  pending: "Pendiente",
  approved: "Apto",
  rejected: "No apto",
  declined: "Declinó oferta",
  discarded: "Descartado",
  hired: "Ingresó",
  in_guarantee: "En garantía",
  guarantee_met: "Garantía cumplida",
  guarantee_failed: "Baja",
  replacement: "Reposición",
};

const REJECTION_LABELS: Record<RejectionCategory, string> = {
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

interface UpdateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: CandidateStatus;
  onConfirm: (
    status: CandidateStatus,
    rejectionCategory?: RejectionCategory,
    rejectionDetails?: string
  ) => void;
  isLoading?: boolean;
}

export default function UpdateStatusDialog({
  open,
  onOpenChange,
  currentStatus,
  onConfirm,
  isLoading,
}: UpdateStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<CandidateStatus | "">("");
  const [rejectionCategory, setRejectionCategory] = useState<RejectionCategory | "">("");
  const [rejectionDetails, setRejectionDetails] = useState("");

  const nextStatuses = NEXT_STATUSES[currentStatus] ?? [];
  const needsRejection = selectedStatus === "rejected" || selectedStatus === "declined";

  const handleConfirm = () => {
    if (!selectedStatus) return;
    onConfirm(
      selectedStatus,
      needsRejection && rejectionCategory ? rejectionCategory : undefined,
      needsRejection && rejectionDetails ? rejectionDetails : undefined
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar estatus</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nuevo estatus</Label>
            {nextStatuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este estatus no permite cambios adicionales.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedStatus(s)}
                    className={`text-sm px-3 py-2 rounded-md border text-left transition-colors ${
                      selectedStatus === s
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {needsRejection && (
            <>
              <div className="space-y-1">
                <Label>Motivo</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={rejectionCategory}
                  onChange={(e) =>
                    setRejectionCategory(e.target.value as RejectionCategory)
                  }
                >
                  <option value="">Selecciona un motivo</option>
                  {(Object.keys(REJECTION_LABELS) as RejectionCategory[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {REJECTION_LABELS[k]}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Detalles adicionales</Label>
                <Textarea
                  value={rejectionDetails}
                  onChange={(e) => setRejectionDetails(e.target.value)}
                  placeholder="Descripción del motivo..."
                  rows={2}
                />
              </div>
            </>
          )}

          <Button
            onClick={handleConfirm}
            disabled={!selectedStatus || isLoading}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar cambio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
