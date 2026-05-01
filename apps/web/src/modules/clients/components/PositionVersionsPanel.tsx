// 011-puestos-profile-docs / US5 (FR-018) — panel admin-only de versiones.
//
// Tabla colapsable por tipo (contract / pase_visita) con filas archivadas
// ordenadas desc por replaced_at. Cada fila muestra original_name, fechas y un
// botón de descarga. Sólo se renderiza si CASL otorga `read` sobre
// `Position.history` (admin).

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import { useAppAbility } from "@/components/ability-provider";
import { useArchivedPositionDocuments } from "../hooks/useClients";
import { downloadPositionDocument } from "../services/clientService";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/error-utils";
import type { PositionDocumentType } from "@bepro/shared";

interface Props {
  clientId: string;
  positionId: string;
}

export function PositionVersionsPanel({ clientId, positionId }: Props) {
  const ability = useAppAbility();
  const canSee = ability.can("read", "Position.history");
  const [open, setOpen] = useState(false);

  // Cargamos sólo cuando el panel está expandido (lazy).
  const { data: rows, isLoading } = useArchivedPositionDocuments(
    clientId,
    positionId,
    undefined,
    open && canSee,
  );

  if (!canSee) return null;

  function downloadRow(id: string, name: string) {
    downloadPositionDocument(clientId, positionId, id, name).catch((err) =>
      toast.error(getApiErrorMessage(err, "Error al descargar")),
    );
  }

  function rowsByType(type: PositionDocumentType) {
    return (rows ?? []).filter((r) => r.type === type);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-2">
      <CollapsibleTrigger
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-accent"
      >
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        Versiones (admin)
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          (["contract", "pase_visita"] as const).map((type) => {
            const typed = rowsByType(type);
            if (typed.length === 0) return null;
            return (
              <div key={type}>
                <h5 className="text-sm font-medium mb-2">
                  {type === "contract" ? "Contrato" : "Pase de visita"}
                </h5>
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Archivo</TableHead>
                        <TableHead>Subido</TableHead>
                        <TableHead>Reemplazado</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typed.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {r.originalName}
                          </TableCell>
                          <TableCell>
                            {r.uploadedAt
                              ? new Date(r.uploadedAt).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {r.replacedAt
                              ? new Date(r.replacedAt).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => downloadRow(r.id, r.originalName)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })
        )}
        {!isLoading && (rows ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sin versiones archivadas.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
