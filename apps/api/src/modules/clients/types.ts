import type { IClientFormConfig } from "@bepro/shared";

export interface ClientRow {
  id: string;
  tenantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  formConfig: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  formConfig?: IClientFormConfig;
}

export interface UpdateClientInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
  formConfig?: IClientFormConfig;
}

export interface ListClientsInput {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}
