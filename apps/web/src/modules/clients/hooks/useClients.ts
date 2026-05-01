import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClient,
  listClients,
  getClientById,
  updateClient,
  createAssignment,
  listAssignments,
  deleteAssignment,
  batchAssignClient,
  type IBatchAssignmentsRequest,
  createFormConfigField,
  patchFormConfigField,
  type ICustomFormField,
  createContact,
  listContacts,
  updateContact,
  deleteContact,
  createPosition,
  listPositions,
  getPosition,
  updatePosition,
  deletePosition,
  // 011-puestos-profile-docs — perfil + documents (los hooks legacy de
  // documentos a nivel cliente se removieron en US3).
  type ICreatePositionRequest,
  type IUpdatePositionRequest,
  createPositionDocument,
  uploadPositionDocumentBytes,
  downloadPositionDocument,
  softDeletePositionDocument,
  listArchivedPositionDocuments,
} from "../services/clientService";
import type {
  ICreateClientRequest,
  IUpdateClientRequest,
  IAssignUserRequest,
  ICreateContactRequest,
  IUpdateContactRequest,
  CreatePositionDocumentInput,
  PositionDocumentType,
} from "@bepro/shared";

export const CLIENT_KEYS = {
  all: ["clients"] as const,
  lists: () => [...CLIENT_KEYS.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...CLIENT_KEYS.lists(), params] as const,
  details: () => [...CLIENT_KEYS.all, "detail"] as const,
  detail: (id: string) => [...CLIENT_KEYS.details(), id] as const,
  assignments: (clientId: string) => [...CLIENT_KEYS.all, "assignments", clientId] as const,
  contacts: (clientId: string) => [...CLIENT_KEYS.all, "contacts", clientId] as const,
  positions: (clientId: string) => [...CLIENT_KEYS.all, "positions", clientId] as const,
  documents: (clientId: string) => [...CLIENT_KEYS.all, "documents", clientId] as const,
};

// -- Client CRUD --

export function useClients(params: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: CLIENT_KEYS.list(params),
    queryFn: () => listClients(params),
    staleTime: 30_000,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: CLIENT_KEYS.detail(id),
    queryFn: () => getClientById(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICreateClientRequest) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.lists() });
    },
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IUpdateClientRequest) => updateClient(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.lists() });
    },
  });
}

// -- Assignments --

export function useAssignments(clientId: string) {
  return useQuery({
    queryKey: CLIENT_KEYS.assignments(clientId),
    queryFn: () => listAssignments(clientId),
    enabled: !!clientId,
  });
}

export function useCreateAssignment(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IAssignUserRequest) => createAssignment(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.assignments(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

export function useDeleteAssignment(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assignmentId: string) => deleteAssignment(clientId, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.assignments(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

// 008 expansion — polymorphic batch-assign for a client (AE + recruiter).
export function useBatchAssignClient(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IBatchAssignmentsRequest) =>
      batchAssignClient(clientId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.assignments(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

// 008-ux-roles-refinements / US6 — admin-managed custom formConfig fields.
export function useCreateFormConfigField(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      input: {
        key: string;
        label: string;
        type: ICustomFormField["type"];
        required?: boolean;
        options?: string[] | null;
      },
    ) => createFormConfigField(clientId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

export function usePatchFormConfigField(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      key,
      input,
    }: {
      key: string;
      input: {
        label?: string;
        required?: boolean;
        options?: string[] | null;
        archived?: boolean;
      };
    }) => patchFormConfigField(clientId, key, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

// -- Contacts --

export function useContacts(clientId: string) {
  return useQuery({
    queryKey: CLIENT_KEYS.contacts(clientId),
    queryFn: () => listContacts(clientId),
    enabled: !!clientId,
  });
}

export function useCreateContact(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICreateContactRequest) => createContact(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.contacts(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

export function useUpdateContact(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: IUpdateContactRequest }) =>
      updateContact(clientId, contactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.contacts(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

export function useDeleteContact(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contactId: string) => deleteContact(clientId, contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.contacts(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

// -- Positions --

export function usePositions(clientId: string, includeInactive = false) {
  return useQuery({
    queryKey: [...CLIENT_KEYS.positions(clientId), { includeInactive }],
    queryFn: () => listPositions(clientId, includeInactive),
    enabled: !!clientId,
  });
}

// 011 — single position fetch (detalle / edición)
export function usePosition(clientId: string, positionId: string | undefined) {
  return useQuery({
    queryKey: [...CLIENT_KEYS.positions(clientId), "detail", positionId],
    queryFn: () => getPosition(clientId, positionId!),
    enabled: !!clientId && !!positionId,
  });
}

export function useCreatePosition(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICreatePositionRequest) => createPosition(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.positions(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

export function useUpdatePosition(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ positionId, data }: { positionId: string; data: IUpdatePositionRequest }) =>
      updatePosition(clientId, positionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.positions(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

export function useDeletePosition(clientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (positionId: string) => deletePosition(clientId, positionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.positions(clientId) });
      queryClient.invalidateQueries({ queryKey: CLIENT_KEYS.detail(clientId) });
    },
  });
}

// -- Position documents (011 / US2) --

export function useUploadPositionDocument(clientId: string, positionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      type,
    }: {
      file: File;
      type: PositionDocumentType;
    }) => {
      const input: CreatePositionDocumentInput = {
        type,
        originalName: file.name,
        mimeType: file.type as CreatePositionDocumentInput["mimeType"],
        sizeBytes: file.size,
      };
      const record = await createPositionDocument(clientId, positionId, input);
      return await uploadPositionDocumentBytes(
        clientId,
        positionId,
        record.id,
        file,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...CLIENT_KEYS.positions(clientId), "detail", positionId],
      });
      queryClient.invalidateQueries({
        queryKey: CLIENT_KEYS.positions(clientId),
      });
    },
  });
}

export function useSoftDeletePositionDocument(
  clientId: string,
  positionId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      softDeletePositionDocument(clientId, positionId, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...CLIENT_KEYS.positions(clientId), "detail", positionId],
      });
      queryClient.invalidateQueries({
        queryKey: CLIENT_KEYS.positions(clientId),
      });
    },
  });
}

export function useArchivedPositionDocuments(
  clientId: string,
  positionId: string,
  type?: PositionDocumentType,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      ...CLIENT_KEYS.positions(clientId),
      "detail",
      positionId,
      "history",
      { type },
    ],
    queryFn: () => listArchivedPositionDocuments(clientId, positionId, type),
    enabled: enabled && !!clientId && !!positionId,
  });
}

// Helper hook for inline downloads (icon click etc.)
export function downloadPositionDocumentClient(
  clientId: string,
  positionId: string,
  documentId: string,
  fileName: string,
) {
  return downloadPositionDocument(clientId, positionId, documentId, fileName);
}
