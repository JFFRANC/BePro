import { useState, useRef } from "react";
import { useDocuments, useUploadDocument, useDeleteDocument } from "../hooks/useClients";
import { downloadDocument } from "../services/clientService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Upload, Download, Trash2, FileText } from "lucide-react";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import type { IClientDocumentDto } from "@bepro/shared";

const DOC_TYPE_LABELS: Record<string, string> = {
  quotation: "Cotización",
  interview_pass: "Pase de entrevista",
  position_description: "Descripción de puestos",
};

const DOC_TYPE_OPTIONS: Record<string, string> = {
  quotation: "Cotización (PDF)",
  interview_pass: "Pase de entrevista (PNG)",
  position_description: "Descripción de puestos (Excel)",
};

const DOC_TYPE_ACCEPT: Record<string, string> = {
  quotation: ".pdf",
  interview_pass: ".png",
  position_description: ".xlsx,.xls",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentManagerProps {
  clientId: string;
  readOnly?: boolean;
}

export function DocumentManager({ clientId, readOnly = false }: DocumentManagerProps) {
  const { data: documents, isLoading } = useDocuments(clientId);
  const uploadDocument = useUploadDocument(clientId);
  const deleteDocument = useDeleteDocument(clientId);

  const [selectedType, setSelectedType] = useState<string>("quotation");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("El archivo excede el tamaño máximo de 10 MB");
      return;
    }

    try {
      await uploadDocument.mutateAsync({ file, documentType: selectedType });
      toast.success("Documento subido exitosamente");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al subir documento"));
    }

    // Limpiar input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (doc: IClientDocumentDto) => {
    try {
      await downloadDocument(clientId, doc.id, doc.originalName);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al descargar documento"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Formulario de carga */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div>
            <label className="text-sm font-medium mb-1 block">Tipo de documento</label>
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v ?? "quotation")}>
              <SelectTrigger className="w-[220px]">
                {DOC_TYPE_OPTIONS[selectedType]}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quotation">Cotización (PDF)</SelectItem>
                <SelectItem value="interview_pass">Pase de entrevista (PNG)</SelectItem>
                <SelectItem value="position_description">Descripción de puestos (Excel)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept={DOC_TYPE_ACCEPT[selectedType]}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadDocument.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadDocument.isPending ? "Subiendo..." : "Seleccionar archivo"}
            </Button>
          </div>
        </div>
      )}

      {/* Tabla de documentos */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tamaño</TableHead>
              <TableHead>Subido por</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                </TableRow>
              ))
            ) : !documents?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 p-0">
                  <EmptyState
                    icon={FileText}
                    title="Sin documentos"
                    description="No hay documentos cargados para este cliente"
                  />
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.originalName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatFileSize(doc.sizeBytes)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{doc.uploaderName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString("es-MX")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            try {
                              await deleteDocument.mutateAsync(doc.id);
                              toast.success("Documento eliminado");
                            } catch (err) {
                              toast.error(getApiErrorMessage(err, "Error al eliminar documento"));
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
