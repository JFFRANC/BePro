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

// 008 expansion — atomic batch set of client assignments (AE + recruiter).
export interface IBatchAssignmentsRequest {
  accountExecutives: string[];
  recruiters: { userId: string; accountExecutiveId?: string }[];
}

export interface IBatchAssignmentsResponse {
  clientId: string;
  added: {
    userId: string;
    role: "account_executive" | "recruiter";
    at: string;
  }[];
  removed: {
    userId: string;
    reason: "explicit" | "cascade";
    at: string;
  }[];
  reparented: {
    userId: string;
    from: string | null;
    to: string | null;
    at: string;
  }[];
  unchanged: string[];
}

export async function batchAssignClient(
  clientId: string,
  payload: IBatchAssignmentsRequest,
): Promise<IBatchAssignmentsResponse> {
  const response = await apiClient.post<IBatchAssignmentsResponse>(
    `/clients/${clientId}/assignments/batch`,
    payload,
  );
  return response.data;
}

// 008-ux-roles-refinements / US6 — custom formConfig fields CRUD.
export interface ICustomFormField {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "checkbox" | "select";
  required: boolean;
  options: string[] | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function createFormConfigField(
  clientId: string,
  input: {
    key: string;
    label: string;
    type: ICustomFormField["type"];
    required?: boolean;
    options?: string[] | null;
  },
): Promise<ICustomFormField> {
  const res = await apiClient.post<{ clientId: string; field: ICustomFormField }>(
    `/clients/${clientId}/form-config/fields`,
    input,
  );
  return res.data.field;
}

export async function patchFormConfigField(
  clientId: string,
  key: string,
  input: {
    label?: string;
    required?: boolean;
    options?: string[] | null;
    archived?: boolean;
  },
): Promise<ICustomFormField> {
  const res = await apiClient.patch<{ clientId: string; field: ICustomFormField }>(
    `/clients/${clientId}/form-config/fields/${encodeURIComponent(key)}`,
    input,
  );
  return res.data.field;
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
