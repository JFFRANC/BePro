// 011-puestos-profile-docs / US2 — slot por tipo (contract / pase_visita).
//
// Estados:
//   - Vacío: botón "Subir contrato" / "Subir pase de visita".
//   - Activo: file name + size + uploaded date + acciones (Descargar / Reemplazar / Eliminar).
//
// Validaciones cliente: MIME ∈ FR-013, size ≤ 10 MiB. Server re-valida.

import { useRef, useState } from "react";
import {
  POSITION_DOCUMENT_ALLOWED_MIME_TYPES,
  MAX_POSITION_DOCUMENT_BYTES,
  type IClientPositionDto,
  type IPositionDocumentSummary,
  type PositionDocumentType,
} from "@bepro/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useUploadPositionDocument,
  useSoftDeletePositionDocument,
} from "../hooks/useClients";
import { downloadPositionDocument } from "../services/clientService";
import { useAppAbility } from "@/components/ability-provider";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/lib/error-utils";
import { Download, Upload, FileText, Trash2 } from "lucide-react";

const TYPE_LABELS: Record<PositionDocumentType, string> = {
  contract: "Contrato",
  pase_visita: "Pase de visita",
};

const MIME_ACCEPT = POSITION_DOCUMENT_ALLOWED_MIME_TYPES.join(",");

interface PositionDocumentSlotProps {
  clientId: string;
  positionId: string;
  type: PositionDocumentType;
  // Pasamos la posición completa para extraer el id del doc activo y el nombre.
  position: IClientPositionDto;
}

export function PositionDocumentSlot({
  clientId,
  positionId,
  type,
  position,
}: PositionDocumentSlotProps) {
  const ability = useAppAbility();
  const canManage = ability.can("update", "PositionDocument");
  const isAdmin = ability.can("manage", "all");

  const fileInput = useRef<HTMLInputElement | null>(null);
  const upload = useUploadPositionDocument(clientId, positionId);
  const softDelete = useSoftDeletePositionDocument(clientId, positionId);
  const [error, setError] = useState<string | null>(null);

  const docSummary: { id: string } | undefined =
    position.documents?.[type] ?? undefined;

  // Para mostrar nombre/size la API debería incluirlo en el DTO. Por ahora
  // mantenemos "Documento activo" como placeholder cuando no tenemos detalles.
  const meta = docSummary
    ? ({
        id: docSummary.id,
        // Estos campos requieren ampliar el endpoint /:posId con docs detallados.
        // Para US2 mínimo nos basta con el id; el download genera el filename.
        type,
      } as Partial<IPositionDocumentSummary> & { id: string })
    : null;

  function pickFile() {
    fileInput.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    if (file.size > MAX_POSITION_DOCUMENT_BYTES) {
      setError(`El archivo excede el límite de ${MAX_POSITION_DOCUMENT_BYTES / 1024 / 1024} MB.`);
      return;
    }
    if (!POSITION_DOCUMENT_ALLOWED_MIME_TYPES.includes(file.type as never)) {
      setError("Formato no permitido. PDF, DOC o DOCX.");
      return;
    }

    try {
      await upload.mutateAsync({ file, type });
      toast.success(
        meta
          ? `${TYPE_LABELS[type]} reemplazado`
          : `${TYPE_LABELS[type]} subido`,
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al subir el documento"));
    }
  }

  async function handleDownload() {
    if (!meta) return;
    try {
      await downloadPositionDocument(
        clientId,
        positionId,
        meta.id,
        `${TYPE_LABELS[type]}.pdf`,
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al descargar"));
    }
  }

  async function handleDelete() {
    if (!meta) return;
    if (!window.confirm(`¿Eliminar el ${TYPE_LABELS[type].toLowerCase()} actual?`))
      return;
    try {
      await softDelete.mutateAsync(meta.id);
      toast.success("Documento eliminado");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al eliminar"));
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h4 className="font-medium">{TYPE_LABELS[type]}</h4>
        </div>

        {meta ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Documento activo</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pickFile}
                  disabled={upload.isPending}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Reemplazar
                </Button>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={softDelete.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Sin documento.</p>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={pickFile}
                disabled={upload.isPending}
              >
                <Upload className="h-4 w-4 mr-2" />
                Subir {TYPE_LABELS[type].toLowerCase()}
              </Button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <input
          ref={fileInput}
          type="file"
          accept={MIME_ACCEPT}
          className="hidden"
          onChange={onFile}
        />
      </CardContent>
    </Card>
  );
}
