// 007-candidates-module — hooks de TanStack Query.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCandidate,
  getActivePrivacyNotice,
  getCandidateById,
  listAttachments,
  listCandidates,
  listDeclineCategories,
  listRejectionCategories,
  patchCandidate,
  probeDuplicates,
  reactivateCandidate,
  setAttachmentObsolete,
  transitionCandidate,
  type CandidateAttachmentDto,
  type CategoryDto,
  type ListCandidatesParams,
  type TransitionInput,
} from "../services/candidateApi";
import type {
  ICandidateDetail,
  IDuplicateSummary,
  RegisterCandidateRequest,
} from "@bepro/shared";

export const CANDIDATE_KEYS = {
  all: ["candidates"] as const,
  lists: () => [...CANDIDATE_KEYS.all, "list"] as const,
  list: (params: Record<string, unknown>) =>
    [...CANDIDATE_KEYS.lists(), params] as const,
  details: () => [...CANDIDATE_KEYS.all, "detail"] as const,
  detail: (id: string) => [...CANDIDATE_KEYS.details(), id] as const,
  privacyNotice: () => [...CANDIDATE_KEYS.all, "privacy-notice", "active"] as const,
};

// Lee el aviso de privacidad activo del tenant — usado por la página de registro.
export function useActivePrivacyNotice() {
  return useQuery({
    queryKey: CANDIDATE_KEYS.privacyNotice(),
    queryFn: () => getActivePrivacyNotice(),
    staleTime: 60_000,
  });
}

// Hook con manejo del flujo de duplicados (R2 / FR-014/FR-015).
// Estados expuestos:
//   - `submit(body)`           → intenta crear; si la API responde 409, parkea
//                                el body y expone `duplicates`.
//   - `duplicates`             → lista de candidatos en conflicto (vacío si no hay).
//   - `confirmDuplicates()`    → re-envía el body con `duplicate_confirmation`.
//   - `cancelDuplicates()`     → limpia el estado para que el usuario edite y reintente.
//   - `created`, `error`, `isPending` — estado del mutation subyacente.
export function useCreateCandidate(options?: {
  onCreated?: (candidate: ICandidateDetail) => void;
}) {
  const queryClient = useQueryClient();
  const [duplicates, setDuplicates] = useState<IDuplicateSummary[]>([]);
  const [pendingBody, setPendingBody] = useState<RegisterCandidateRequest | null>(
    null,
  );

  const mutation = useMutation({
    mutationFn: (body: RegisterCandidateRequest) => createCandidate(body),
    onSuccess: (result) => {
      if (result.kind === "duplicates") {
        setDuplicates(result.duplicates);
        return;
      }
      setDuplicates([]);
      setPendingBody(null);
      queryClient.invalidateQueries({ queryKey: CANDIDATE_KEYS.lists() });
      options?.onCreated?.(result.candidate);
    },
  });

  function submit(body: RegisterCandidateRequest) {
    setPendingBody(body);
    mutation.mutate(body);
  }

  function confirmDuplicates() {
    if (!pendingBody) return;
    const ids = duplicates.map((d) => d.id);
    mutation.mutate({
      ...pendingBody,
      duplicate_confirmation: { confirmed_duplicate_ids: ids },
    });
  }

  function cancelDuplicates() {
    setDuplicates([]);
    setPendingBody(null);
  }

  return {
    submit,
    confirmDuplicates,
    cancelDuplicates,
    duplicates,
    pendingBody,
    created:
      mutation.data && mutation.data.kind === "created"
        ? mutation.data.candidate
        : null,
    error: mutation.error,
    isPending: mutation.isPending,
  };
}

// Listado paginado role-scoped (US2).
export function useCandidatesList(params: ListCandidatesParams) {
  return useQuery({
    queryKey: CANDIDATE_KEYS.list(params as Record<string, unknown>),
    queryFn: () => listCandidates(params),
    staleTime: 10_000,
  });
}

// Detalle (US2).
export function useCandidate(id: string | undefined) {
  return useQuery({
    queryKey: CANDIDATE_KEYS.detail(id ?? ""),
    queryFn: () => getCandidateById(id!),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

// US3 — transitions
export function useTransitionCandidate(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionInput) =>
      transitionCandidate(candidateId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CANDIDATE_KEYS.detail(candidateId),
      });
      queryClient.invalidateQueries({ queryKey: CANDIDATE_KEYS.lists() });
    },
  });
}

// US3 — reactivate
export function useReactivateCandidate(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { note?: string }) =>
      reactivateCandidate(candidateId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CANDIDATE_KEYS.detail(candidateId),
      });
      queryClient.invalidateQueries({ queryKey: CANDIDATE_KEYS.lists() });
    },
  });
}

// US4 — attachments
export function useAttachments(candidateId: string, includeObsolete = false) {
  return useQuery({
    queryKey: [...CANDIDATE_KEYS.detail(candidateId), "attachments", includeObsolete],
    queryFn: () => listAttachments(candidateId, includeObsolete),
    enabled: Boolean(candidateId),
  });
}
export function useSetAttachmentObsolete(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { attId: string; isObsolete: boolean }) =>
      setAttachmentObsolete(candidateId, params.attId, params.isObsolete),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...CANDIDATE_KEYS.detail(candidateId), "attachments"],
      });
    },
  });
}

// US5 — categories
export function useRejectionCategories() {
  return useQuery({
    queryKey: ["candidates", "categories", "rejection"],
    queryFn: listRejectionCategories,
    staleTime: 30_000,
  });
}
export function useDeclineCategories() {
  return useQuery({
    queryKey: ["candidates", "categories", "decline"],
    queryFn: listDeclineCategories,
    staleTime: 30_000,
  });
}

// US6 — PATCH PII
export function usePatchCandidate(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      body: Partial<{
        first_name: string;
        last_name: string;
        phone: string;
        email: string;
        current_position: string;
        source: string;
        additional_fields: Record<string, unknown>;
      }>,
    ) => patchCandidate(candidateId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CANDIDATE_KEYS.detail(candidateId),
      });
    },
  });
}

export type { CandidateAttachmentDto, CategoryDto };

// Sondeo de duplicados antes de enviar (UX opcional — quickstart §1).
export function useDuplicateProbe(query: {
  client_id?: string;
  phone?: string;
}) {
  const enabled = Boolean(
    query.client_id && query.phone && query.phone.length >= 8,
  );
  return useQuery({
    queryKey: [
      ...CANDIDATE_KEYS.all,
      "duplicates-probe",
      query.client_id,
      query.phone,
    ],
    queryFn: () => probeDuplicates(query as { client_id: string; phone: string }),
    enabled,
    staleTime: 5_000,
  });
}
