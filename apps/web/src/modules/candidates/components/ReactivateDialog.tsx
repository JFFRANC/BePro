// 007-candidates-module — reactivación admin (FR-038a) con énfasis warning.
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { useReactivateCandidate } from "../hooks/useCandidates";

interface ReactivateDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidateId: string;
}

export function ReactivateDialog({
  open,
  onOpenChange,
  candidateId,
}: ReactivateDialogProps) {
  const [note, setNote] = useState("");
  const mutation = useReactivateCandidate(candidateId);

  async function handleSubmit() {
    try {
      await mutation.mutateAsync({ note: note || undefined });
      toast.success("Candidato reactivado.");
      setNote("");
      onOpenChange(false);
    } catch (err) {
      const r = (err as { response?: { status?: number; data?: { message?: string } } })
        .response;
      toast.error(r?.data?.message ?? "No se pudo reactivar.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setNote("");
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-warning/15 text-warning">
              <AlertTriangle className="size-4" aria-hidden="true" />
            </span>
            <DialogTitle>Reactivar candidato</DialogTitle>
          </div>
          <DialogDescription>
            Sólo admins. El estado terminal se conserva en el historial; se
            marca el candidato como activo nuevamente para que vuelva a aparecer
            en los listados por defecto.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="reactivate-note">Justificación (opcional)</Label>
          <Textarea
            id="reactivate-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1.5"
            placeholder="Razón por la que se reactiva (queda registrada en el historial)"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="warning"
            onClick={handleSubmit}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Reactivando…" : "Reactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
