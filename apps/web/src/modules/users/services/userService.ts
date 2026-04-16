import { apiClient } from "@/lib/api-client";
import type { IUserDto, IUserListResponse, IBulkImportResult } from "@bepro/shared";

export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  isFreelancer: boolean;
}): Promise<IUserDto> {
  const response = await apiClient.post<{ data: IUserDto }>("/users", data);
  return response.data.data;
}

export async function listUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  isFreelancer?: boolean;
}): Promise<IUserListResponse> {
  const response = await apiClient.get<IUserListResponse>("/users", { params });
  return response.data;
}

export async function getUserById(id: string): Promise<IUserDto> {
  const response = await apiClient.get<{ data: IUserDto }>(`/users/${id}`);
  return response.data.data;
}

export async function importUsers(file: File): Promise<IBulkImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<{ data: IBulkImportResult }>("/users/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
}

export async function forceChangePassword(
  userId: string,
  data: { currentPassword: string; newPassword: string },
): Promise<{ success: true; accessToken: string; user: IUserDto }> {
  const response = await apiClient.post<{
    success: true;
    accessToken: string;
    user: IUserDto;
  }>(`/users/${userId}/change-password`, data);
  return response.data;
}

export async function changePassword(
  userId: string,
  data: { currentPassword: string; newPassword: string },
): Promise<{ success: true }> {
  const response = await apiClient.post<{ success: true }>(`/users/${userId}/change-password`, data);
  return response.data;
}

export async function resetUserPassword(
  userId: string,
  data: { newPassword: string },
): Promise<{ success: true }> {
  const response = await apiClient.post<{ success: true }>(`/users/${userId}/reset-password`, data);
  return response.data;
}

export async function deactivateUser(userId: string): Promise<IUserDto> {
  const response = await apiClient.patch<{ data: IUserDto }>(`/users/${userId}/deactivate`);
  return response.data.data;
}

export async function reactivateUser(userId: string): Promise<IUserDto> {
  const response = await apiClient.patch<{ data: IUserDto }>(`/users/${userId}/reactivate`);
  return response.data.data;
}

export async function updateUser(
  id: string,
  data: { firstName?: string; lastName?: string; role?: string; isFreelancer?: boolean },
): Promise<IUserDto> {
  const response = await apiClient.patch<{ data: IUserDto }>(`/users/${id}`, data);
  return response.data.data;
}
