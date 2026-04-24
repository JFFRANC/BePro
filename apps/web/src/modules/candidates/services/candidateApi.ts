// 007-candidates-module — wrappers de fetch para los endpoints de candidatos.
import { apiClient } from "@/lib/api-client";
import type {
  ICandidateDetail,
  IDuplicateSummary,
  RegisterCandidateRequest,
} from "@bepro/shared";

export interface ActivePrivacyNotice {
  id: string;
  version: string;
  text_md: string;
  effective_from: string;
}

export async function getActivePrivacyNotice(): Promise<ActivePrivacyNotice | null> {
  try {
    const res = await apiClient.get<{ privacy_notice: ActivePrivacyNotice }>(
      "/candidates/privacy-notice/active",
    );
    return res.data.privacy_notice;
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      (err as { response?: { status?: number } }).response?.status === 404
    ) {
      return null;
    }
    throw err;
  }
}

export async function probeDuplicates(query: {
  client_id: string;
  phone: string;
}): Promise<IDuplicateSummary[]> {
  const res = await apiClient.get<{ duplicates: IDuplicateSummary[] }>(
    "/candidates/duplicates",
    { params: query },
  );
  return res.data.duplicates;
}

export interface CreateCandidateResponse {
  candidate: ICandidateDetail;
}

export interface DuplicatesDetectedResponse {
  code: "duplicates_detected";
  message: string;
  duplicates: IDuplicateSummary[];
}

// ----- US2 -----

export interface ListCandidatesParams {
  q?: string;
  status?: string[];
  client_id?: string[];
  recruiter_user_id?: string[];
  rejection_category_id?: string[];
  decline_category_id?: string[];
  updated_from?: string;
  updated_to?: string;
  include_inactive?: boolean;
  cursor?: string;
  limit?: number;
}

export interface ListCandidatesResponse {
  items: import("@bepro/shared").ICandidateListItem[];
  next_cursor: string | null;
}

export async function listCandidates(
  params: ListCandidatesParams,
): Promise<ListCandidatesResponse> {
  const res = await apiClient.get<ListCandidatesResponse>("/candidates", {
    params,
    paramsSerializer: { indexes: null },
  });
  return res.data;
}

export interface CandidateDetailResponse {
  candidate: ICandidateDetail;
  privacy_notice: { id: string; version: string; effective_from: string } | null;
  status_history: Array<{
    id: string;
    actor_id: string;
    created_at: string;
    old_values: unknown;
    new_values: unknown;
  }>;
  duplicate_links: { as_new: string[]; as_existing: string[] };
}

export async function getCandidateById(
  id: string,
): Promise<CandidateDetailResponse> {
  const res = await apiClient.get<CandidateDetailResponse>(`/candidates/${id}`);
  return res.data;
}

// ----- US3: transitions + reactivate -----

export interface TransitionInput {
  from_status: string;
  to_status: string;
  rejection_category_id?: string;
  decline_category_id?: string;
  note?: string;
}

export async function transitionCandidate(
  candidateId: string,
  body: TransitionInput,
): Promise<{ candidate: ICandidateDetail }> {
  const res = await apiClient.post<{ candidate: ICandidateDetail }>(
    `/candidates/${candidateId}/transitions`,
    body,
  );
  return res.data;
}

export async function reactivateCandidate(
  candidateId: string,
  body: { note?: string },
): Promise<{ candidate: ICandidateDetail }> {
  const res = await apiClient.post<{ candidate: ICandidateDetail }>(
    `/candidates/${candidateId}/reactivate`,
    body,
  );
  return res.data;
}

// ----- US4: attachments -----

export interface CandidateAttachmentDto {
  id: string;
  candidate_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  tag: string | null;
  is_obsolete: boolean;
  uploaded_at: string | null;
}

export async function listAttachments(
  candidateId: string,
  includeObsolete = false,
): Promise<CandidateAttachmentDto[]> {
  const res = await apiClient.get<{ attachments: CandidateAttachmentDto[] }>(
    `/candidates/${candidateId}/attachments`,
    { params: includeObsolete ? { include_obsolete: true } : {} },
  );
  return res.data.attachments;
}

export async function initAttachment(
  candidateId: string,
  body: { file_name: string; mime_type: string; size_bytes: number; tag?: string },
): Promise<{ attachment_id: string; storage_key: string; upload_url: string }> {
  const res = await apiClient.post<{
    attachment_id: string;
    storage_key: string;
    upload_url: string;
  }>(`/candidates/${candidateId}/attachments`, body);
  return res.data;
}

export async function uploadAttachmentBinary(
  uploadUrl: string,
  file: File,
): Promise<void> {
  // El upload va contra el path devuelto (relativo a /api/...). axios apiClient
  // ya tiene baseURL=/api; el upload_url incluye /api/... → quitamos el prefijo.
  const path = uploadUrl.replace(/^\/api/, "");
  await apiClient.post(path, file, {
    headers: { "Content-Type": file.type },
    transformRequest: [(data) => data],
  });
}

export async function setAttachmentObsolete(
  candidateId: string,
  attId: string,
  isObsolete: boolean,
): Promise<void> {
  await apiClient.patch(
    `/candidates/${candidateId}/attachments/${attId}`,
    { is_obsolete: isObsolete },
  );
}

// Descarga auth-aware: el endpoint requiere Authorization header, así que un
// `<a href>` plano no sirve. Hacemos un GET con el apiClient (que adjunta el
// token) y disparamos la descarga via blob URL.
export async function downloadAttachment(
  candidateId: string,
  attId: string,
  fileName: string,
): Promise<void> {
  const res = await apiClient.get(
    `/candidates/${candidateId}/attachments/${attId}/download`,
    { responseType: "blob" },
  );
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ----- US5: categories -----

export interface CategoryDto {
  id: string;
  label: string;
  is_active: boolean;
}

export async function listRejectionCategories(): Promise<CategoryDto[]> {
  const res = await apiClient.get<{ items: CategoryDto[] }>(
    "/candidates/categories/rejection",
  );
  return res.data.items;
}
export async function listDeclineCategories(): Promise<CategoryDto[]> {
  const res = await apiClient.get<{ items: CategoryDto[] }>(
    "/candidates/categories/decline",
  );
  return res.data.items;
}
export async function createRejectionCategory(label: string): Promise<CategoryDto> {
  const res = await apiClient.post<{ item: CategoryDto }>(
    "/candidates/categories/rejection",
    { label },
  );
  return res.data.item;
}
export async function createDeclineCategory(label: string): Promise<CategoryDto> {
  const res = await apiClient.post<{ item: CategoryDto }>(
    "/candidates/categories/decline",
    { label },
  );
  return res.data.item;
}
export async function updateRejectionCategory(
  id: string,
  body: { label?: string; is_active?: boolean },
): Promise<CategoryDto> {
  const res = await apiClient.patch<{ item: CategoryDto }>(
    `/candidates/categories/rejection/${id}`,
    body,
  );
  return res.data.item;
}
export async function updateDeclineCategory(
  id: string,
  body: { label?: string; is_active?: boolean },
): Promise<CategoryDto> {
  const res = await apiClient.patch<{ item: CategoryDto }>(
    `/candidates/categories/decline/${id}`,
    body,
  );
  return res.data.item;
}

// ----- US6: PATCH PII -----

export async function patchCandidate(
  candidateId: string,
  body: Partial<{
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    current_position: string;
    source: string;
    additional_fields: Record<string, unknown>;
  }>,
): Promise<{ candidate: ICandidateDetail }> {
  const res = await apiClient.patch<{ candidate: ICandidateDetail }>(
    `/candidates/${candidateId}`,
    body,
  );
  return res.data;
}

// Devuelve el candidato creado o, si la API responde 409, una lista de duplicados
// para que el llamador decida si re-confirmar.
export async function createCandidate(
  body: RegisterCandidateRequest,
): Promise<
  | { kind: "created"; candidate: ICandidateDetail }
  | { kind: "duplicates"; duplicates: IDuplicateSummary[] }
> {
  try {
    const res = await apiClient.post<CreateCandidateResponse>("/candidates", body);
    return { kind: "created", candidate: res.data.candidate };
  } catch (err) {
    const r = (err as { response?: { status?: number; data?: DuplicatesDetectedResponse } })
      .response;
    if (r?.status === 409 && r.data?.code === "duplicates_detected") {
      return { kind: "duplicates", duplicates: r.data.duplicates };
    }
    throw err;
  }
}
