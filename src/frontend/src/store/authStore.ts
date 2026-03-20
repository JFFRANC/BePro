"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ICurrentUser } from "@/types/auth";

interface AuthState {
  user: ICurrentUser | null;
  isAuthenticated: boolean;
  setUser: (user: ICurrentUser) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearUser: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "bepro-auth",
    }
  )
);
