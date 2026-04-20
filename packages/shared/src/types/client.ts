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

export interface IClientPositionDto {
  id: string;
  clientId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
