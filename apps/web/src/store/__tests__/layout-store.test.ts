import { describe, it, expect, beforeEach, vi } from "vitest";
import { useLayoutStore } from "@/store/layout-store";

describe("useLayoutStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    useLayoutStore.setState({ sidebarCollapsed: false, mobileDrawerOpen: false });
  });

  it("has sane defaults on first load", () => {
    const state = useLayoutStore.getState();
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.mobileDrawerOpen).toBe(false);
  });

  it("toggleSidebar flips sidebarCollapsed", () => {
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
    useLayoutStore.getState().toggleSidebar();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
  });

  it("persists sidebarCollapsed under the 'bepro.layout' key", () => {
    useLayoutStore.getState().setSidebarCollapsed(true);
    const raw = localStorage.getItem("bepro.layout");
    expect(raw).toBeTruthy();
    expect(raw).toContain("sidebarCollapsed");
    expect(raw).toContain("true");
  });

  it("does NOT persist mobileDrawerOpen", () => {
    useLayoutStore.getState().openMobileDrawer();
    const raw = localStorage.getItem("bepro.layout");
    if (raw) {
      expect(raw).not.toContain("mobileDrawerOpen");
    }
  });

  it("openMobileDrawer / closeMobileDrawer mutate state in memory", () => {
    useLayoutStore.getState().openMobileDrawer();
    expect(useLayoutStore.getState().mobileDrawerOpen).toBe(true);
    useLayoutStore.getState().closeMobileDrawer();
    expect(useLayoutStore.getState().mobileDrawerOpen).toBe(false);
  });

  it("keeps working in memory when localStorage.setItem throws (private browsing)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => useLayoutStore.getState().setSidebarCollapsed(true)).not.toThrow();
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
  });
});
