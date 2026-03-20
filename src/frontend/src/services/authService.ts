import { jwtDecode } from "jwt-decode";
import api from "@/lib/axios";
import type { ILoginRequest, IAuthResponse, ICurrentUser } from "@/types/auth";
import type { UserRole } from "@/types/auth";

interface JwtPayload {
  sub: string;
  email: string;
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": string;
  firstName: string;
  lastName: string;
  isFreelancer: string;
  exp: number;
}

function parseUserFromToken(token: string): ICurrentUser {
  const payload = jwtDecode<JwtPayload>(token);
  return {
    id: payload.sub,
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] as UserRole,
    isFreelancer: payload.isFreelancer === "true",
  };
}

function setCookie(name: string, value: string) {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=${value}; path=/; SameSite=Strict`;
  }
}

function clearCookie(name: string) {
  if (typeof document !== "undefined") {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

export const authService = {
  async login(data: ILoginRequest): Promise<ICurrentUser> {
    const response = await api.post<{ success: boolean; data: IAuthResponse }>(
      "/auth/login",
      data
    );
    const { accessToken, refreshToken } = response.data.data;
    setCookie("accessToken", accessToken);
    setCookie("refreshToken", refreshToken);
    return parseUserFromToken(accessToken);
  },

  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } finally {
      clearCookie("accessToken");
      clearCookie("refreshToken");
    }
  },

  async refreshToken(): Promise<void> {
    const refreshToken =
      typeof document !== "undefined"
        ? document.cookie
            .split("; ")
            .find((c) => c.startsWith("refreshToken="))
            ?.split("=")[1]
        : undefined;

    const response = await api.post<{ success: boolean; data: IAuthResponse }>(
      "/auth/refresh-token",
      { refreshToken }
    );
    const { accessToken, refreshToken: newRefresh } = response.data.data;
    setCookie("accessToken", accessToken);
    setCookie("refreshToken", newRefresh);
  },

  getTokenFromCookie(): string | undefined {
    if (typeof document === "undefined") return undefined;
    return document.cookie
      .split("; ")
      .find((c) => c.startsWith("accessToken="))
      ?.split("=")[1];
  },
};
