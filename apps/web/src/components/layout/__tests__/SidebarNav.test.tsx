import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithRouter } from "./render-helpers";
import { NAV_CONFIG } from "@/lib/nav-config";
import { useLayoutStore } from "@/store/layout-store";
import { SidebarNav, filterDevItems } from "../SidebarNav";

describe("SidebarNav (ungated — Phase 3)", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ sidebarCollapsed: false, mobileDrawerOpen: false });
  });

  afterEach(() => cleanup());

  it("renders every item in NAV_CONFIG (ungated render)", () => {
    renderWithRouter(<SidebarNav />);
    for (const group of NAV_CONFIG) {
      for (const item of group.items) {
        const link = screen.getByRole("link", { name: item.label });
        expect(link.getAttribute("href")).toBe(item.path);
      }
    }
  });

  it("renders labeled group headings", () => {
    renderWithRouter(<SidebarNav />);
    for (const group of NAV_CONFIG) {
      if (group.label) {
        expect(screen.getByText(group.label)).not.toBeNull();
      }
    }
  });

  it("marks the active item based on the current route", () => {
    renderWithRouter(<SidebarNav />, { route: "/users" });
    const users = screen.getByRole("link", { name: "Usuarios" });
    expect(users.getAttribute("data-active")).toBe("true");
  });

  it("marks prefix-matched children as active", () => {
    renderWithRouter(<SidebarNav />, { route: "/users/abc" });
    const users = screen.getByRole("link", { name: "Usuarios" });
    expect(users.getAttribute("data-active")).toBe("true");
  });
});

describe("filterDevItems (FR-014)", () => {
  const devGroup = NAV_CONFIG.find((g) => g.id === "dev");
  if (!devGroup) throw new Error("dev group missing from NAV_CONFIG");
  const designSystem = devGroup.items.find((i) => i.id === "design-system");
  if (!designSystem) throw new Error("design-system item missing");

  it("keeps devOnly items when isDev=true", () => {
    const visible = filterDevItems([designSystem], true);
    expect(visible).toHaveLength(1);
  });

  it("removes devOnly items when isDev=false (production)", () => {
    const visible = filterDevItems([designSystem], false);
    expect(visible).toHaveLength(0);
  });

  it("preserves non-devOnly items regardless of isDev", () => {
    const dashboard = NAV_CONFIG[0].items[0];
    expect(filterDevItems([dashboard], true)).toHaveLength(1);
    expect(filterDevItems([dashboard], false)).toHaveLength(1);
  });
});
