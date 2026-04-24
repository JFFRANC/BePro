// 007-candidates-module — uploader simple. Valida MIME + tamaño localmente y
// notifica al padre via callbacks (sin throw — un evento DOM no debe lanzar).
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png",
  "application/zip",
];
const MAX_BYTES = 10 * 1024 * 1024;

export interface PendingAttachment {
  file: File;
  tag?: string;
}

interface AttachmentUploaderProps {
  attachment: PendingAttachment | null;
  onChange: (att: PendingAttachment | null) => void;
  /** Notifica errores de validación (MIME inválido o tamaño excedido). */
  onError?: (message: string | null) => void;
  error?: string;
  disabled?: boolean;
  label?: string;
  helperText?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentUploader({
  attachment,
  onChange,
  onError,
  error,
  disabled,
  label = "Adjuntar CV (opcional)",
  helperText = "PDF, DOCX, JPG, PNG o ZIP — máximo 10 MB.",
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      onChange(null);
      onError?.(null);
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      if (inputRef.current) inputRef.current.value = "";
      onChange(null);
      onError?.("Tipo de archivo no permitido. Usa PDF, DOCX, JPG, PNG o ZIP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      if (inputRef.current) inputRef.current.value = "";
      onChange(null);
      onError?.("El archivo excede el límite de 10 MB.");
      return;
    }
    onError?.(null);
    onChange({ file, tag: "cv" });
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    onChange(null);
    onError?.(null);
  }

  return (
    <div className="space-y-2">
      {attachment ? (
        <div className="flex items-center justify-between rounded-md border p-3 text-sm">
          <span className="flex items-center gap-2 min-w-0">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{attachment.file.name}</span>
            <span
              className="text-xs text-muted-foreground shrink-0"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatBytes(attachment.file.size)}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clear}
            disabled={disabled}
            aria-label="Quitar adjunto"
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="mr-2 size-4" />
          {label}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIME.join(",")}
        className="hidden"
        onChange={handleFile}
        aria-label="Archivo del candidato"
      />
      {error ? (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
