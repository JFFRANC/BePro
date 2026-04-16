import type { UserRole } from "./auth.js";

export interface IUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isFreelancer: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isFreelancer: boolean;
}

export interface IUpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isFreelancer?: boolean;
}

export interface IUserListResponse {
  data: IUserDto[];
  pagination: IPaginationMeta;
}

export interface IPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface IBulkImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  results: IBulkImportRowResult[];
}

export interface IBulkImportRowResult {
  row: number;
  status: "success" | "error";
  email: string;
  temporaryPassword?: string;
  error?: string;
}
