import { create } from "zustand";
import type { ICurrentUser } from "@bepro/shared";
import { apiClient } from "@/lib/api-client";

interface AuthState {
  accessToken: string | null;
  user: ICurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, tenantSlug: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuth: (token: string, user: ICurrentUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("accessToken"),
  user: null,
  isAuthenticated: !!localStorage.getItem("accessToken"),
  isLoading: false,

  login: async (email, password, tenantSlug) => {
    set({ isLoading: true });
    try {
      const { data } = await apiClient.post("/auth/login", {
        email,
        password,
        tenantSlug,
      });
      localStorage.setItem("accessToken", data.accessToken);
      set({
        accessToken: data.accessToken,
        user: data.user,
        isAuthenticated: true,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await apiClient.post(
        "/auth/logout",
        {},
        { headers: { "X-Requested-With": "fetch" } },
      );
    } finally {
      localStorage.removeItem("accessToken");
      set({
        accessToken: null,
        user: null,
        isAuthenticated: false,
      });
    }
  },

  setAuth: (token, user) => {
    localStorage.setItem("accessToken", token);
    set({ accessToken: token, user, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem("accessToken");
    set({ accessToken: null, user: null, isAuthenticated: false });
  },
}));
