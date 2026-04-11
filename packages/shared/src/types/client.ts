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
  contactInfo?: string;
  address?: string;
  isActive: boolean;
  formConfig: IClientFormConfig;
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

export interface ICreateClientRequest {
  name: string;
  contactInfo?: string;
  address?: string;
  formConfig?: IClientFormConfig;
}

export interface IUpdateClientRequest {
  name?: string;
  contactInfo?: string;
  address?: string;
  isActive?: boolean;
  formConfig?: IClientFormConfig;
}

export interface IAssignUserRequest {
  userId: string;
  accountExecutiveId?: string;
}
