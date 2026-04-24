// 007-candidates-module — listado de adjuntos (US4) con upload post-creación.
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Paperclip, Download, Archive, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAttachments,
  useSetAttachmentObsolete,
  CANDIDATE_KEYS,
} from "../hooks/useCandidates";
import {
  AttachmentUploader,
  type PendingAttachment,
} from "./AttachmentUploader";
import {
  downloadAttachment,
  initAttachment,
  uploadAttachmentBinary,
} from "../services/candidateApi";
import { useConfirm } from "@/components/confirm-dialog";

interface AttachmentListProps {
  candidateId: string;
  canEdit: boolean;
  canSeeObsolete: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentList({
  candidateId,
  canEdit,
  canSeeObsolete,
}: AttachmentListProps) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const [includeObsolete, setIncludeObsolete] = useState(false);
  const [pending, setPending] = useState<PendingAttachment | null>(null);
  const [uploaderError, setUploaderError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading } = useAttachments(candidateId, includeObsolete);
  const setObsolete = useSetAttachmentObsolete(candidateId);

  async function handleUpload() {
    if (!pending) return;
    setUploading(true);
    try {
      const init = await initAttachment(candidateId, {
        file_name: pending.file.name,
        mime_type: pending.file.type,
        size_bytes: pending.file.size,
        tag: pending.tag,
      });
      await uploadAttachmentBinary(init.upload_url, pending.file);
      toast.success("Adjunto subido.");
      setPending(null);
      queryClient.invalidateQueries({
        queryKey: [...CANDIDATE_KEYS.detail(candidateId), "attachments"],
      });
    } catch {
      toast.error("No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleObsolete(attId: string) {
    const ok = await confirm({
      title: "Marcar adjunto como obsoleto",
      description:
        "Quedará oculto de la vista por defecto, pero seguirá almacenado por LFPDPPP.",
      confirmLabel: "Marcar obsoleto",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await setObsolete.mutateAsync({ attId, isObsolete: true });
      toast.success("Adjunto marcado como obsoleto.");
    } catch {
      toast.error("No se pudo actualizar el adjunto.");
    }
  }

  async function handleDownload(attId: string, fileName: string) {
    setDownloadingId(attId);
    try {
      await downloadAttachment(candidateId, attId, fileName);
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Adjuntos</CardTitle>
        {canSeeObsolete ? (
          <label className="text-xs flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={includeObsolete}
              onCheckedChange={(v) => setIncludeObsolete(Boolean(v))}
              aria-label="Incluir adjuntos obsoletos"
            />
            Incluir obsoletos
          </label>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Uploader (sólo si tiene permiso de edición) */}
        {canEdit ? (
          <div className="space-y-2 rounded-md border-2 border-dashed border-border p-3">
            <AttachmentUploader
              attachment={pending}
              onChange={setPending}
              onError={setUploaderError}
              error={uploaderError ?? undefined}
              disabled={uploading}
              label="Adjuntar nuevo archivo"
            />
            {pending ? (
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPending(null)}
                  disabled={uploading}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />
                      Subiendo…
                    </>
                  ) : (
                    "Subir adjunto"
                  )}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Listado */}
        {isLoading ? (
          <ul className="space-y-2" aria-busy="true" aria-live="polite">
            {Array.from({ length: 2 }).map((_, i) => (
              <li key={i} className="rounded-md border p-3">
                <Skeleton className="h-4 w-3/4" />
              </li>
            ))}
          </ul>
        ) : (data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No hay adjuntos para este candidato.
          </p>
        ) : (
          <ul className="space-y-2">
            {data!.map((a) => {
              const downloading = downloadingId === a.id;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent/30"
                >
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    <Paperclip
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="truncate">{a.file_name}</span>
                    <span
                      className="text-xs text-muted-foreground shrink-0"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatBytes(a.size_bytes)}
                    </span>
                    {a.is_obsolete && (
                      <Badge variant="outline" className="ml-1">
                        Obsoleto
                      </Badge>
                    )}
                    {a.tag && (
                      <Badge variant="secondary" className="ml-1">
                        {a.tag}
                      </Badge>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Descargar ${a.file_name}`}
                      disabled={downloading}
                      onClick={() => handleDownload(a.id, a.file_name)}
                    >
                      {downloading ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="size-4" aria-hidden="true" />
                      )}
                    </Button>
                    {canEdit && !a.is_obsolete && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Marcar ${a.file_name} como obsoleto`}
                        onClick={() => handleObsolete(a.id)}
                      >
                        <Archive className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
