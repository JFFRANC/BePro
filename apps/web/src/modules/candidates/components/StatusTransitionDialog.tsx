// 007-candidates-module — diálogo de transición de estado (US3).
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FSM_LEGAL_EDGES,
  statusLabel,
  type CandidateStatus,
} from "@bepro/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CategoryPicker } from "./RejectionCategoryPicker";
import { useTransitionCandidate } from "../hooks/useCandidates";
import { isNegativeTerminal } from "@bepro/shared";

interface StatusTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  currentStatus: CandidateStatus;
}

export function StatusTransitionDialog({
  open,
  onOpenChange,
  candidateId,
  currentStatus,
}: StatusTransitionDialogProps) {
  const allowed = useMemo(
    () => FSM_LEGAL_EDGES[currentStatus] ?? [],
    [currentStatus],
  );

  const [toStatus, setToStatus] = useState<CandidateStatus | "">("");
  const [note, setNote] = useState("");
  const [rejectionId, setRejectionId] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);

  const mutation = useTransitionCandidate(candidateId);

  function reset() {
    setToStatus("");
    setNote("");
    setRejectionId(null);
    setDeclineId(null);
  }

  async function handleSubmit() {
    if (!toStatus) return;
    try {
      await mutation.mutateAsync({
        from_status: currentStatus,
        to_status: toStatus,
        rejection_category_id: toStatus === "rejected" ? rejectionId ?? undefined : undefined,
        decline_category_id: toStatus === "declined" ? declineId ?? undefined : undefined,
        note: note || undefined,
      });
      toast.success(`Estado cambiado a ${statusLabel(toStatus)}`);
      reset();
      onOpenChange(false);
    } catch (err) {
      const r = (err as { response?: { status?: number; data?: { code?: string } } })
        .response;
      if (r?.status === 409 && r.data?.code === "stale_status") {
        toast.error("El estado fue modificado por otro usuario. Refrescando…");
        onOpenChange(false);
      } else {
        toast.error("No se pudo aplicar la transición.");
      }
    }
  }

  const requiresRejectionCat = toStatus === "rejected";
  const requiresDeclineCat = toStatus === "declined";
  const isNegative = toStatus ? isNegativeTerminal(toStatus) : false;
  const submitDisabled =
    !toStatus ||
    (requiresRejectionCat && !rejectionId) ||
    (requiresDeclineCat && !declineId) ||
    mutation.isPending;
  const submitLabel = mutation.isPending
    ? "Aplicando…"
    : toStatus
      ? `Cambiar a ${statusLabel(toStatus)}`
      : "Aplicar";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar estado</DialogTitle>
          <DialogDescription>
            Estado actual: <strong>{statusLabel(currentStatus)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nuevo estado</Label>
            {allowed.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                Estado terminal — no hay transiciones disponibles.
              </p>
            ) : (
              <Select
                value={toStatus}
                onValueChange={(v) => setToStatus(v as CandidateStatus)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecciona…" />
                </SelectTrigger>
                <SelectContent>
                  {allowed.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {requiresRejectionCat && (
            <div>
              <Label>Motivo de rechazo *</Label>
              <div className="mt-1.5">
                <CategoryPicker
                  kind="rejection"
                  value={rejectionId}
                  onChange={setRejectionId}
                />
              </div>
            </div>
          )}
          {requiresDeclineCat && (
            <div>
              <Label>Motivo de declinación *</Label>
              <div className="mt-1.5">
                <CategoryPicker
                  kind="decline"
                  value={declineId}
                  onChange={setDeclineId}
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="mt-1.5"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant={isNegative ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={submitDisabled}
          >
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
