import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { placementService } from "@/services/placementService";
import type { ICreatePlacementRequest, IUpdatePlacementRequest } from "@/types/placement";
import { CANDIDATE_KEYS } from "./useCandidates";

export const PLACEMENT_KEYS = {
  byClient: (clientId: string) => ["placements", "client", clientId] as const,
  detail: (id: string) => ["placements", id] as const,
};

export function usePlacementsByClient(clientId: string) {
  return useQuery({
    queryKey: PLACEMENT_KEYS.byClient(clientId),
    queryFn: () => placementService.getByClient(clientId),
    enabled: !!clientId,
  });
}

export function usePlacement(id: string) {
  return useQuery({
    queryKey: PLACEMENT_KEYS.detail(id),
    queryFn: () => placementService.getById(id),
    enabled: !!id,
  });
}

export function useCreatePlacement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ICreatePlacementRequest) => placementService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["placements"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

export function useUpdatePlacement(id: string, clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: IUpdatePlacementRequest) =>
      placementService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PLACEMENT_KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: PLACEMENT_KEYS.byClient(clientId) });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}
