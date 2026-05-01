export interface IClientFormConfig {
  showInterviewTime: boolean;
  showPosition: boolean;
  showMunicipality: boolean;
  showAge: boolean;
  showShift: boolean;
  showPlant: boolean;
  showInterviewPoint: boolean;
  showComments: boolean;
}

export interface IClientDto {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  formConfig: IClientFormConfig;
  createdAt: string;
  updatedAt: string;
}

export interface IClientDetailDto extends IClientDto {
  contacts: IClientContactDto[];
  positions: IClientPositionDto[];
  assignments: IClientAssignmentDto[];
}

export interface IClientAssignmentDto {
  id: string;
  clientId: string;
  clientName: string;
  userId: string;
  userFullName: string;
  userRole: string;
  accountExecutiveId?: string;
  accountExecutiveFullName?: string;
}

export interface IClientContactDto {
  id: string;
  clientId: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

// 011-puestos-profile-docs — perfil completo + summary de documentos activos.
// Cada campo de perfil es opcional; sólo `name` es obligatorio (FR-002).
export interface IClientPositionDto {
  id: string;
  clientId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  vacancies?: number | null;
  workLocation?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  gender?: "masculino" | "femenino" | "indistinto" | null;
  civilStatus?: "soltero" | "casado" | "indistinto" | null;
  educationLevel?:
    | "ninguna"
    | "primaria"
    | "secundaria"
    | "preparatoria"
    | "tecnica"
    | "licenciatura"
    | "posgrado"
    | null;
  experienceText?: string | null;
  salaryAmount?: number | null;
  salaryCurrency?: "MXN" | "USD" | "EUR" | null;
  paymentFrequency?: "weekly" | "biweekly" | "monthly" | null;
  salaryNotes?: string | null;
  benefits?: string | null;
  scheduleText?: string | null;
  workDays?:
    | ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[]
    | null;
  shift?: "fixed" | "rotating" | null;
  requiredDocuments?: string[] | null;
  responsibilities?: string | null;
  faq?: string[] | null;
  // Resumen de documentos activos (FR-010 — íconos en lista de puestos)
  documents?: {
    contract?: { id: string };
    pase_visita?: { id: string };
  };
}

export interface IClientDocumentDto {
  id: string;
  clientId: string;
  originalName: string;
  documentType: "quotation" | "interview_pass" | "position_description";
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploaderName: string;
  createdAt: string;
}

export interface IClientListResponse {
  data: IClientDto[];
  pagination: IClientPaginationMeta;
}

export interface IClientPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ICreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  formConfig?: IClientFormConfig;
}

export interface IUpdateClientRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  formConfig?: IClientFormConfig;
}

export interface IAssignUserRequest {
  userId: string;
  accountExecutiveId?: string;
}

export interface ICreateContactRequest {
  name: string;
  phone: string;
  email: string;
}

export interface IUpdateContactRequest {
  name?: string;
  phone?: string;
  email?: string;
}

export interface ICreatePositionRequest {
  name: string;
}

export interface IUpdatePositionRequest {
  name?: string;
}
