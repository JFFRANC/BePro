// 011-puestos-profile-docs — DTOs y unions de tipos compartidas

export type PositionGender = "masculino" | "femenino" | "indistinto";
export type PositionCivilStatus = "soltero" | "casado" | "indistinto";
export type PositionEducationLevel =
  | "ninguna"
  | "primaria"
  | "secundaria"
  | "preparatoria"
  | "tecnica"
  | "licenciatura"
  | "posgrado";
export type PositionPaymentFrequency = "weekly" | "biweekly" | "monthly";
export type PositionCurrency = "MXN" | "USD" | "EUR";
export type PositionShift = "fixed" | "rotating";
export type PositionWorkDay =
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat"
  | "sun";
export type PositionDocumentType = "contract" | "pase_visita";

export interface IPositionDocumentSummary {
  id: string;
  type: PositionDocumentType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string | null;
}

export interface IClientPositionDocumentsMap {
  contract?: { id: string };
  pase_visita?: { id: string };
}

export interface IClientPositionProfileFields {
  vacancies?: number | null;
  workLocation?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  gender?: PositionGender | null;
  civilStatus?: PositionCivilStatus | null;
  educationLevel?: PositionEducationLevel | null;
  experienceText?: string | null;
  salaryAmount?: number | null;
  salaryCurrency?: PositionCurrency | null;
  paymentFrequency?: PositionPaymentFrequency | null;
  salaryNotes?: string | null;
  benefits?: string | null;
  scheduleText?: string | null;
  workDays?: PositionWorkDay[] | null;
  shift?: PositionShift | null;
  requiredDocuments?: string[] | null;
  responsibilities?: string | null;
  faq?: string[] | null;
}

export interface IPositionDocumentDto {
  id: string;
  positionId: string;
  type: PositionDocumentType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  isActive: boolean;
  uploadedAt: string | null;
  replacedAt: string | null;
  uploadedBy: string;
  uploaderName?: string;
  createdAt: string;
}

export interface ICreatePositionDocumentResponse {
  id: string;
  uploadUrl: string;
  expiresAt: string;
}
