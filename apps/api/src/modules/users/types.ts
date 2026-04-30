import type { UserRole } from "@bepro/shared";

export interface ListUsersParams {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  isFreelancer?: boolean;
  currentUser: {
    id: string;
    role: UserRole;
  };
}

export interface CreateUserParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isFreelancer: boolean;
  // 010 — primary client capture. Required for AE/recruiter at the validator
  // layer; silently ignored when role is admin/manager (defensive no-op).
  clientId?: string;
}

export interface UpdateUserParams {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isFreelancer?: boolean;
}

export interface BulkImportRow {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isFreelancer: boolean;
}

export interface BulkImportRowResult {
  row: number;
  status: "success" | "error";
  email: string;
  temporaryPassword?: string;
  error?: string;
}

export interface BulkImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  results: BulkImportRowResult[];
}
