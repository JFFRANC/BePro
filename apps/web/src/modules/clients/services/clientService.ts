import { apiClient } from "@/lib/api-client";
import type {
  IClientDto,
  IClientDetailDto,
  IClientListResponse,
  IClientContactDto,
  IClientPositionDto,
  IClientDocumentDto,
  IClientAssignmentDto,
  ICreateClientRequest,
  IUpdateClientRequest,
  IAssignUserRequest,
  ICreateContactRequest,
  IUpdateContactRequest,
  ICreatePositionRequest,
  IUpdatePositionRequest,
} from "@bepro/shared";

// -- Client CRUD --

export async function createClient(data: ICreateClientRequest): Promise<IClientDto> {
  const response = await apiClient.post<{ data: IClientDto }>("/clients", data);
  return response.data.data;
}

export async function listClients(params: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}): Promise<IClientListResponse> {
  const response = await apiClient.get<IClientListResponse>("/clients", { params });
  return response.data;
}

export async function getClientById(id: string): Promise<IClientDetailDto> {
  const response = await apiClient.get<{ data: IClientDetailDto }>(`/clients/${id}`);
  return response.data.data;
}

export async function updateClient(
  id: string,
  data: IUpdateClientRequest,
): Promise<IClientDto> {
  const response = await apiClient.patch<{ data: IClientDto }>(`/clients/${id}`, data);
  return response.data.data;
}

// -- Assignments --

export async function createAssignment(
  clientId: string,
  data: IAssignUserRequest,
): Promise<IClientAssignmentDto> {
  const response = await apiClient.post<{ data: IClientAssignmentDto }>(
    `/clients/${clientId}/assignments`,
    data,
  );
  return response.data.data;
}

export async function listAssignments(clientId: string): Promise<IClientAssignmentDto[]> {
  const response = await apiClient.get<{ data: IClientAssignmentDto[] }>(
    `/clients/${clientId}/assignments`,
  );
  return response.data.data;
}

export async function deleteAssignment(clientId: string, assignmentId: string): Promise<void> {
  await apiClient.delete(`/clients/${clientId}/assignments/${assignmentId}`);
}

// -- Contacts --

export async function createContact(
  clientId: string,
  data: ICreateContactRequest,
): Promise<IClientContactDto> {
  const response = await apiClient.post<{ data: IClientContactDto }>(
    `/clients/${clientId}/contacts`,
    data,
  );
  return response.data.data;
}

export async function listContacts(clientId: string): Promise<IClientContactDto[]> {
  const response = await apiClient.get<{ data: IClientContactDto[] }>(
    `/clients/${clientId}/contacts`,
  );
  return response.data.data;
}

export async function updateContact(
  clientId: string,
  contactId: string,
  data: IUpdateContactRequest,
): Promise<IClientContactDto> {
  const response = await apiClient.patch<{ data: IClientContactDto }>(
    `/clients/${clientId}/contacts/${contactId}`,
    data,
  );
  return response.data.data;
}

export async function deleteContact(clientId: string, contactId: string): Promise<void> {
  await apiClient.delete(`/clients/${clientId}/contacts/${contactId}`);
}

// -- Positions --

export async function createPosition(
  clientId: string,
  data: ICreatePositionRequest,
): Promise<IClientPositionDto> {
  const response = await apiClient.post<{ data: IClientPositionDto }>(
    `/clients/${clientId}/positions`,
    data,
  );
  return response.data.data;
}

export async function listPositions(
  clientId: string,
  includeInactive = false,
): Promise<IClientPositionDto[]> {
  const response = await apiClient.get<{ data: IClientPositionDto[] }>(
    `/clients/${clientId}/positions`,
    { params: includeInactive ? { includeInactive: "true" } : undefined },
  );
  return response.data.data;
}

export async function updatePosition(
  clientId: string,
  positionId: string,
  data: IUpdatePositionRequest,
): Promise<IClientPositionDto> {
  const response = await apiClient.patch<{ data: IClientPositionDto }>(
    `/clients/${clientId}/positions/${positionId}`,
    data,
  );
  return response.data.data;
}

export async function deletePosition(clientId: string, positionId: string): Promise<void> {
  await apiClient.delete(`/clients/${clientId}/positions/${positionId}`);
}

// -- Documents --

export async function uploadDocument(
  clientId: string,
  file: File,
  documentType: string,
): Promise<IClientDocumentDto> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  const response = await apiClient.post<{ data: IClientDocumentDto }>(
    `/clients/${clientId}/documents`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return response.data.data;
}

export async function listDocuments(clientId: string): Promise<IClientDocumentDto[]> {
  const response = await apiClient.get<{ data: IClientDocumentDto[] }>(
    `/clients/${clientId}/documents`,
  );
  return response.data.data;
}

export async function downloadDocument(clientId: string, documentId: string, fileName: string): Promise<void> {
  const response = await apiClient.get(`/clients/${clientId}/documents/${documentId}/download`, {
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function deleteDocument(clientId: string, documentId: string): Promise<void> {
  await apiClient.delete(`/clients/${clientId}/documents/${documentId}`);
}
