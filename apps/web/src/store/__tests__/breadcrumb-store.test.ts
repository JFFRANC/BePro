import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBreadcrumbStore, useBreadcrumbs } from "@/store/breadcrumb-store";

describe("breadcrumb-store", () => {
  beforeEach(() => {
    useBreadcrumbStore.setState({ trail: null });
  });

  it("setTrail stores the trail", () => {
    const trail = [
      { label: "Candidatos", to: "/candidates" },
      { label: "María López" },
    ];
    useBreadcrumbStore.getState().setTrail(trail);
    expect(useBreadcrumbStore.getState().trail).toEqual(trail);
  });

  it("setTrail(null) clears the trail", () => {
    useBreadcrumbStore.getState().setTrail([{ label: "x" }]);
    useBreadcrumbStore.getState().setTrail(null);
    expect(useBreadcrumbStore.getState().trail).toBeNull();
  });

  it("rejects an empty array with a dev warning and leaves the trail null", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    useBreadcrumbStore.getState().setTrail([]);
    expect(useBreadcrumbStore.getState().trail).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("useBreadcrumbs sets the trail on mount and clears it on unmount", () => {
    const trail = [{ label: "Usuarios", to: "/users" }];
    const { unmount } = renderHook(() => useBreadcrumbs(trail));
    expect(useBreadcrumbStore.getState().trail).toEqual(trail);
    unmount();
    expect(useBreadcrumbStore.getState().trail).toBeNull();
  });

  it("useBreadcrumbs accepts null without setting anything", () => {
    renderHook(() => useBreadcrumbs(null));
    expect(useBreadcrumbStore.getState().trail).toBeNull();
  });
});
