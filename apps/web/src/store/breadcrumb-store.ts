import { useEffect } from "react";
import { create } from "zustand";

export interface BreadcrumbCrumb {
  label: string;
  to?: string;
}

export type BreadcrumbTrail = BreadcrumbCrumb[];

interface BreadcrumbState {
  trail: BreadcrumbTrail | null;
  setTrail: (trail: BreadcrumbTrail | null) => void;
}

export const useBreadcrumbStore = create<BreadcrumbState>((set) => ({
  trail: null,
  setTrail: (trail) => {
    if (trail && trail.length === 0) {
      console.warn("[shell] useBreadcrumbs: empty trail array ignored");
      set({ trail: null });
      return;
    }
    set({ trail });
  },
}));

export function useBreadcrumbs(trail: BreadcrumbTrail | null): void {
  const setTrail = useBreadcrumbStore((s) => s.setTrail);
  useEffect(() => {
    setTrail(trail);
    return () => {
      setTrail(null);
    };
  }, [trail, setTrail]);
}
