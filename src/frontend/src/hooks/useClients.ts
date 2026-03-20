import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientService } from "@/services/clientService";
import type { ICreateClientRequest, IUpdateClientRequest } from "@/types/client";

export const CLIENT_KEYS = {
  all: ["clients"] as const,
  detail: (id: string) => ["clients", id] as const,
  assignments: (id: string) => ["clients", id, "assignments"] as const,
};

export function useClients() {
  return useQuery({
    queryKey: CLIENT_KEYS.all,
    queryFn: clientService.getAll,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: CLIENT_KEYS.detail(id),
    queryFn: () => clientService.getById(id),
    enabled: !!id,
  });
}

export function useClientAssignments(clientId: string) {
  return useQuery({
    queryKey: CLIENT_KEYS.assignments(clientId),
    queryFn: () => clientService.getAssignments(clientId),
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ICreateClientRequest) => clientService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLIENT_KEYS.all }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: IUpdateClientRequest) => clientService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENT_KEYS.all });
      qc.invalidateQueries({ queryKey: CLIENT_KEYS.detail(id) });
    },
  });
}
