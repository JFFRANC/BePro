// 007-candidates-module — diálogo para editar PII (US6 / FR-061).
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePatchCandidate } from "../hooks/useCandidates";
import type { ICandidateDetail } from "@bepro/shared";

interface EditPiiDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: ICandidateDetail;
}

export function EditPiiDialog({
  open,
  onOpenChange,
  candidate,
}: EditPiiDialogProps) {
  const [first, setFirst] = useState(candidate.first_name);
  const [last, setLast] = useState(candidate.last_name);
  const [phone, setPhone] = useState(candidate.phone);
  const [email, setEmail] = useState(candidate.email);
  const [position, setPosition] = useState(candidate.current_position ?? "");
  const [source, setSource] = useState(candidate.source);

  const mutation = usePatchCandidate(candidate.id);

  function reset() {
    setFirst(candidate.first_name);
    setLast(candidate.last_name);
    setPhone(candidate.phone);
    setEmail(candidate.email);
    setPosition(candidate.current_position ?? "");
    setSource(candidate.source);
  }

  async function handleSubmit() {
    const diff: Record<string, string> = {};
    if (first !== candidate.first_name) diff.first_name = first;
    if (last !== candidate.last_name) diff.last_name = last;
    if (phone !== candidate.phone) diff.phone = phone;
    if (email !== candidate.email) diff.email = email;
    if (position !== (candidate.current_position ?? "")) diff.current_position = position;
    if (source !== candidate.source) diff.source = source;

    if (Object.keys(diff).length === 0) {
      onOpenChange(false);
      return;
    }
    try {
      await mutation.mutateAsync(diff);
      toast.success("Datos del candidato actualizados.");
      onOpenChange(false);
    } catch (err) {
      const r = (err as { response?: { status?: number } }).response;
      if (r?.status === 404) {
        toast.error("No tienes permisos para editar este candidato.");
      } else {
        toast.error("No se pudieron guardar los cambios.");
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar datos del candidato</DialogTitle>
          <DialogDescription>
            Cada campo modificado generará un registro append-only en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-first">Nombre(s)</Label>
            <Input
              id="edit-first"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              autoComplete="given-name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="edit-last">Apellidos</Label>
            <Input
              id="edit-last"
              value={last}
              onChange={(e) => setLast(e.target.value)}
              autoComplete="family-name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="edit-phone">Teléfono</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="edit-email">Correo</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-position">Puesto actual</Label>
            <Input
              id="edit-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="edit-source">Fuente</Label>
            <Input
              id="edit-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
