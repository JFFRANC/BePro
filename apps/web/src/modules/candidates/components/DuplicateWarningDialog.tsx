// 007-candidates-module — diálogo de aviso ante duplicados (FR-015).
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { IDuplicateSummary } from "@bepro/shared";
import { statusLabel } from "@bepro/shared";

interface DuplicateWarningDialogProps {
  open: boolean;
  duplicates: IDuplicateSummary[];
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function DuplicateWarningDialog({
  open,
  duplicates,
  onConfirm,
  onCancel,
  isSubmitting,
}: DuplicateWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Posibles candidatos duplicados</DialogTitle>
          <DialogDescription>
            Encontramos {duplicates.length} candidato
            {duplicates.length === 1 ? "" : "s"} con el mismo teléfono para este
            cliente. Confirma que es intencional para continuar.
          </DialogDescription>
        </DialogHeader>

        <ul role="list" className="space-y-2 max-h-60 overflow-auto">
          {duplicates.map((d) => (
            <li
              key={d.id}
              className="rounded-md border p-3 text-sm flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="font-medium truncate">
                    {d.first_name} {d.last_name}
                  </p>
                  <Link
                    to={`/candidates/${d.id}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline shrink-0"
                    aria-label={`Abrir detalle de ${d.first_name} ${d.last_name} en una pestaña nueva`}
                  >
                    Ver detalle
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reclutador:{" "}
                  <span className="font-medium">
                    {d.registering_user.display_name}
                  </span>
                </p>
                <p
                  className="text-xs text-muted-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  Registrado: {new Date(d.created_at).toLocaleDateString("es-MX")}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {statusLabel(d.status)}
              </Badge>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            Sí, registrar de todas formas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
