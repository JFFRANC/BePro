import { apiClient } from "@/lib/api-client";
import type { ICurrentUser } from "@bepro/shared";

export interface RequestPasswordResetArgs {
  email: string;
}

export interface RequestPasswordResetResponse {
  message: string;
}

export async function requestPasswordReset(
  args: RequestPasswordResetArgs,
): Promise<RequestPasswordResetResponse> {
  const { data } = await apiClient.post<RequestPasswordResetResponse>(
    "/auth/password-reset/request",
    args,
    { headers: { "X-Requested-With": "fetch" } },
  );
  return data;
}

export interface ConfirmPasswordResetArgs {
  token: string;
  password: string;
}

export interface ConfirmPasswordResetResponse {
  accessToken: string;
  expiresAt: string;
  user: ICurrentUser;
}

export async function confirmPasswordReset(
  args: ConfirmPasswordResetArgs,
): Promise<ConfirmPasswordResetResponse> {
  const { data } = await apiClient.post<ConfirmPasswordResetResponse>(
    "/auth/password-reset/confirm",
    args,
    { headers: { "X-Requested-With": "fetch" } },
  );
  return data;
}
