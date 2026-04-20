import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import { safeLocalStorage } from "@/lib/safe-storage";
import { emit } from "@/lib/telemetry";

interface LayoutState {
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  openMobileDrawer: () => void;
  closeMobileDrawer: () => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      mobileDrawerOpen: false,
      toggleSidebar: () => {
        const next = !get().sidebarCollapsed;
        set({ sidebarCollapsed: next });
        emit({ name: "sidebar.toggle", payload: { collapsed: next } });
      },
      setSidebarCollapsed: (v) => {
        set({ sidebarCollapsed: v });
        emit({ name: "sidebar.toggle", payload: { collapsed: v } });
      },
      openMobileDrawer: () => {
        set({ mobileDrawerOpen: true });
        emit({ name: "mobile-drawer.open", payload: {} });
      },
      closeMobileDrawer: () => {
        set({ mobileDrawerOpen: false });
      },
    }),
    {
      name: "bepro.layout",
      storage: createJSONStorage(() => safeLocalStorage as StateStorage),
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
);
