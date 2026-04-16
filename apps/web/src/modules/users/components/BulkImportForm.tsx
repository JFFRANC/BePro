import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useImportUsers } from "../hooks/useUsers";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import { Upload, Download, FileText } from "lucide-react";
import type { IBulkImportResult } from "@bepro/shared";

function escapeCSVField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

interface BulkImportFormProps {
  onClose?: () => void;
}

export function BulkImportForm({ onClose }: BulkImportFormProps) {
  const [result, setResult] = useState<IBulkImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importUsers = useImportUsers();

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona un archivo CSV");
      return;
    }

    try {
      const data = await importUsers.mutateAsync(file);
      setResult(data);
      toast.success(`${data.successCount} usuario(s) importados exitosamente`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al importar usuarios"));
    }
  };

  const handleDownloadResults = () => {
    if (!result) return;
    const csvHeader = "Fila,Estado,Email,Contraseña temporal,Error\n";
    const csvRows = result.results
      .map(
        (r) =>
          `${r.row},${escapeCSVField(r.status)},${escapeCSVField(r.email)},${escapeCSVField(r.temporaryPassword ?? "")},${escapeCSVField(r.error ?? "")}`,
      )
      .join("\n");
    const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "resultados-importacion.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {!result ? (
        <>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Formato: email, firstName, lastName, role, isFreelancer
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Máximo 100 filas. Los usuarios recibirán una contraseña temporal.
            </p>
            <label htmlFor="csv-upload" className="sr-only">Archivo CSV</label>
            <input
              id="csv-upload"
              ref={fileRef}
              type="file"
              accept=".csv"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
          <div className="flex justify-end gap-2">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            )}
            <Button
              onClick={handleUpload}
              disabled={importUsers.isPending}
            >
              <Upload className="h-4 w-4 mr-2" />
              {importUsers.isPending ? "Importando\u2026" : "Importar CSV"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="space-x-2">
              <Badge variant="default">{result.successCount} exitosos</Badge>
              {result.errorCount > 0 && (
                <Badge variant="destructive">{result.errorCount} errores</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadResults}>
              <Download className="h-4 w-4 mr-2" />
              Descargar CSV
            </Button>
          </div>

          <div className="rounded-md border max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Contraseña / Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell>{r.row}</TableCell>
                    <TableCell>{r.email}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "success" ? "default" : "destructive"}>
                        {r.status === "success" ? "OK" : "Error"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.status === "success"
                        ? r.temporaryPassword
                        : r.error}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </>
      )}
    </div>
  );
}
