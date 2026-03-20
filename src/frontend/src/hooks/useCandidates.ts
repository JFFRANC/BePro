import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { candidateService } from "@/services/candidateService";
import type { ICreateCandidateRequest, IUpdateCandidateStatusRequest } from "@/types/candidate";

export const CANDIDATE_KEYS = {
  byClient: (clientId: string) => ["candidates", "client", clientId] as const,
  my: ["candidates", "my"] as const,
  detail: (id: string) => ["candidates", id] as const,
};

export function useCandidatesByClient(clientId: string) {
  return useQuery({
    queryKey: CANDIDATE_KEYS.byClient(clientId),
    queryFn: () => candidateService.getByClient(clientId),
    enabled: !!clientId,
  });
}

export function useMyCandidates() {
  return useQuery({
    queryKey: CANDIDATE_KEYS.my,
    queryFn: candidateService.getMy,
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: CANDIDATE_KEYS.detail(id),
    queryFn: () => candidateService.getById(id),
    enabled: !!id,
  });
}

export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ICreateCandidateRequest) =>
      candidateService.create(data),
    onSuccess: (candidate) => {
      qc.invalidateQueries({
        queryKey: CANDIDATE_KEYS.byClient(candidate.clientId),
      });
      qc.invalidateQueries({ queryKey: CANDIDATE_KEYS.my });
    },
  });
}

export function useUpdateCandidateStatus(id: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: IUpdateCandidateStatusRequest) =>
      candidateService.updateStatus(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CANDIDATE_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: CANDIDATE_KEYS.byClient(clientId) });
      qc.invalidateQueries({ queryKey: CANDIDATE_KEYS.my });
    },
  });
}
