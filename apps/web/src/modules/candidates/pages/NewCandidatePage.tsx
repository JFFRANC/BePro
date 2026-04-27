// 007-candidates-module — página de registro de candidato (US1 + UI/UX polish).
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClients } from "@/modules/clients/hooks/useClients";
import { Combobox } from "@/components/combobox";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

import {
  CandidateForm,
  type CandidateFormValues,
  type ClientFormConfigShape,
} from "../components/CandidateForm";
// 008-ux-roles-refinements / US7 — PrivacyNoticeCheckbox removed from the flow
// (FR-RP-001 / FR-RP-005). Evidence is collected offline by the recruiter per
// constitution v1.0.2 §VI.
import {
  AttachmentUploader,
  type PendingAttachment,
} from "../components/AttachmentUploader";
import { DuplicateWarningDialog } from "../components/DuplicateWarningDialog";
import { useCreateCandidate } from "../hooks/useCandidates";
import {
  initAttachment,
  uploadAttachmentBinary,
} from "../services/candidateApi";

export function NewCandidatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialClientId = searchParams.get("client") ?? "";

  const [clientId, setClientId] = useState<string>(initialClientId);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Lista de clientes activos para el combobox.
  const clientsQuery = useClients({ page: 1, limit: 100, isActive: true });
  const clientOptions = useMemo(
    () =>
      (clientsQuery.data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [clientsQuery.data],
  );
  const selectedClient = clientsQuery.data?.data.find((c) => c.id === clientId);
  const formConfig = (selectedClient?.formConfig ?? {}) as ClientFormConfigShape;

  const createCandidate = useCreateCandidate({
    onCreated: async (cand) => {
      // Si hay un adjunto pendiente, lo subimos ahora (post-creación).
      if (attachment) {
        setUploading(true);
        try {
          const init = await initAttachment(cand.id, {
            file_name: attachment.file.name,
            mime_type: attachment.file.type,
            size_bytes: attachment.file.size,
            tag: attachment.tag,
          });
          await uploadAttachmentBinary(init.upload_url, attachment.file);
          toast.success(
            `Candidato registrado y CV adjuntado: ${cand.first_name} ${cand.last_name}`,
          );
        } catch {
          toast.warning(
            `Candidato registrado: ${cand.first_name} ${cand.last_name}, pero el CV no se pudo subir. Inténtalo desde su detalle.`,
          );
        } finally {
          setUploading(false);
        }
      } else {
        toast.success(
          `Candidato registrado: ${cand.first_name} ${cand.last_name}`,
        );
      }
      navigate(`/candidates/${cand.id}`);
    },
  });

  function handleValidSubmit(values: CandidateFormValues) {
    // 008 US7 / FR-RP-001/002 — privacy_notice_id intentionally omitted; the
    // server auto-stamps from the tenant's active notice for DB/audit integrity.
    createCandidate.submit(values);
  }

  const showDuplicateDialog = createCandidate.duplicates.length > 0;
  const isSubmitting = createCandidate.isPending || uploading;

  return (
    <div className="page-container py-8 space-y-6">
      <Link
        to="/candidates"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Volver al listado
      </Link>

      <PageHeader
        title="Registrar candidato"
        description="Captura la información básica del candidato y los datos adicionales que requiera el cliente."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente *</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="client-picker" className="sr-only">
            Cliente
          </Label>
          <Combobox
            options={clientOptions}
            value={clientId || undefined}
            onValueChange={(v) => setClientId(v ?? "")}
            placeholder="Selecciona un cliente"
            searchPlaceholder="Buscar cliente…"
            emptyMessage="Sin coincidencias"
            disabled={clientsQuery.isLoading}
          />
          {!clientId && (
            <p className="text-xs text-muted-foreground mt-2">
              Selecciona el cliente al que pertenece esta candidatura para
              cargar los campos correspondientes.
            </p>
          )}
        </CardContent>
      </Card>

      {clientId ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos del candidato</CardTitle>
            </CardHeader>
            <CardContent>
              <CandidateForm
                clientId={clientId}
                formConfig={formConfig}
                onValidSubmit={handleValidSubmit}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">CV (opcional)</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentUploader
                attachment={attachment}
                onChange={setAttachment}
                onError={setAttachmentError}
                error={attachmentError ?? undefined}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/candidates")}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="candidate-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Registrando…" : "Registrar candidato"}
            </Button>
          </div>
        </>
      ) : null}

      <DuplicateWarningDialog
        open={showDuplicateDialog}
        duplicates={createCandidate.duplicates}
        onConfirm={createCandidate.confirmDuplicates}
        onCancel={createCandidate.cancelDuplicates}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
