import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { apiClient } from "@/lib/api-client";
import type { IAuthMeResponse } from "@bepro/shared";

export const AUTH_KEYS = {
  me: ["auth", "me"] as const,
};

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, logout, setAuth, clearAuth } =
    useAuthStore();

  const meQuery = useQuery({
    queryKey: AUTH_KEYS.me,
    queryFn: async () => {
      const { data } = await apiClient.get<IAuthMeResponse>("/auth/me");
      return data.user;
    },
    enabled: isAuthenticated && !user,
    retry: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      setAuth(localStorage.getItem("accessToken") ?? "", meQuery.data);
    }
    if (meQuery.error) {
      clearAuth();
    }
  }, [meQuery.data, meQuery.error, setAuth, clearAuth]);

  return {
    user: user ?? meQuery.data ?? null,
    isAuthenticated,
    isLoading: isLoading || meQuery.isLoading,
    login,
    logout,
  };
}
