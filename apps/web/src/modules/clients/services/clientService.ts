import { apiClient } from "@/lib/api-client";
import type {
  IClientDto,
  IClientDetailDto,
  IClientListResponse,
  IClientContactDto,
  IClientPositionDto,
  IClientAssignmentDto,
  ICreateClientRequest,
  IUpdateClientRequest,
  IAssignUserRequest,
  ICreateContactRequest,
  IUpdateContactRequest,
  CreatePositionProfileInput,
  UpdatePositionProfileInput,
  IPositionDocumentDto,
  ICreatePositionDocumentResponse,
  PositionDocumentType,
  CreatePositionDocumentInput,
} from "@bepro/shared";

// 011-puestos-profile-docs — request shapes (alias para legibilidad).
export type ICreatePositionRequest = CreatePositionProfileInput;
export type IUpdatePositionRequest = UpdatePositionProfileInput;

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

// -- Positions (011 — perfil completo) --

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

export async function getPosition(
  clientId: string,
  positionId: string,
): Promise<IClientPositionDto> {
  const response = await apiClient.get<{ data: IClientPositionDto }>(
    `/clients/${clientId}/positions/${positionId}`,
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

// -- Position documents (011 / US2 — server-proxied R2 upload, ADR-002) --

export async function createPositionDocument(
  clientId: string,
  positionId: string,
  input: CreatePositionDocumentInput,
): Promise<ICreatePositionDocumentResponse> {
  const response = await apiClient.post<{ data: ICreatePositionDocumentResponse }>(
    `/clients/${clientId}/positions/${positionId}/documents`,
    input,
  );
  return response.data.data;
}

export async function uploadPositionDocumentBytes(
  clientId: string,
  positionId: string,
  documentId: string,
  file: File,
): Promise<IPositionDocumentDto> {
  const response = await apiClient.post<{ data: IPositionDocumentDto }>(
    `/clients/${clientId}/positions/${positionId}/documents/${documentId}/upload`,
    file,
    {
      headers: {
        "Content-Type": file.type,
        "Content-Length": String(file.size),
      },
    },
  );
  return response.data.data;
}

export async function downloadPositionDocument(
  clientId: string,
  positionId: string,
  documentId: string,
  fileName: string,
): Promise<void> {
  const response = await apiClient.get(
    `/clients/${clientId}/positions/${positionId}/documents/${documentId}/download`,
    { responseType: "blob" },
  );
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function softDeletePositionDocument(
  clientId: string,
  positionId: string,
  documentId: string,
): Promise<void> {
  await apiClient.delete(
    `/clients/${clientId}/positions/${positionId}/documents/${documentId}`,
  );
}

export async function listArchivedPositionDocuments(
  clientId: string,
  positionId: string,
  type?: PositionDocumentType,
): Promise<IPositionDocumentDto[]> {
  const response = await apiClient.get<{ data: IPositionDocumentDto[] }>(
    `/clients/${clientId}/positions/${positionId}/documents/history`,
    { params: type ? { type } : undefined },
  );
  return response.data.data;
}

// -- Legacy client documents (011 / US3) — endpoints removidos --
//
// Las funciones `uploadDocument` / `listDocuments` / `downloadDocument` /
// `deleteDocument` se eliminaron por completo. Los documentos viven ahora por
// puesto (createPositionDocument / uploadPositionDocumentBytes / etc.). Los
// endpoints legacy de la API responden 410 Gone.
