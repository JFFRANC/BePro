import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LayoutDashboard } from "lucide-react";
import { renderWithRouter } from "./render-helpers";
import type { NavItem } from "@/lib/nav-config";

vi.mock("@/lib/telemetry", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/telemetry")>("@/lib/telemetry");
  return { ...actual, emit: vi.fn() };
});

import { emit } from "@/lib/telemetry";
import { SidebarItem } from "../SidebarItem";

const mockedEmit = vi.mocked(emit);

const item: NavItem = {
  id: "dashboard",
  label: "Dashboard",
  path: "/",
  icon: LayoutDashboard,
  gate: { kind: "roles", roles: ["admin"] },
  exactMatch: true,
};

describe("SidebarItem", () => {
  afterEach(() => {
    cleanup();
    mockedEmit.mockReset();
  });

  it("renders label visible when expanded", () => {
    renderWithRouter(<SidebarItem item={item} collapsed={false} isActive={false} />);
    expect(screen.getByText("Dashboard")).not.toBeNull();
  });

  it("hides label text (sr-only) when collapsed and keeps it accessible via aria-label", () => {
    renderWithRouter(<SidebarItem item={item} collapsed={true} isActive={false} />);
    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link).not.toBeNull();
    // When collapsed, the visible label span is hidden
    const labelSpan = link.querySelector("[data-slot='sidebar-item-label']");
    expect(labelSpan?.className ?? "").toContain("sr-only");
  });

  it("marks itself as active via data-active when isActive=true", () => {
    renderWithRouter(<SidebarItem item={item} collapsed={false} isActive={true} />);
    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link.getAttribute("data-active")).toBe("true");
  });

  it("emits telemetry on click", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SidebarItem item={item} collapsed={false} isActive={false} />);
    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    expect(mockedEmit).toHaveBeenCalledWith({
      name: "nav.click",
      payload: { itemId: "dashboard", path: "/", source: "sidebar" },
    });
  });

  it("surfaces the label as a title tooltip when collapsed (FR-010)", () => {
    renderWithRouter(<SidebarItem item={item} collapsed={true} isActive={false} />);
    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link.getAttribute("title")).toBe("Dashboard");
  });

  it("does NOT set title when expanded (no redundant native tooltip)", () => {
    renderWithRouter(<SidebarItem item={item} collapsed={false} isActive={false} />);
    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link.getAttribute("title")).toBeNull();
  });

  it("marks non-active items with data-active=false", () => {
    renderWithRouter(<SidebarItem item={item} collapsed={false} isActive={false} />);
    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link.getAttribute("data-active")).toBe("false");
  });

  it("sets aria-current=page when active (NavLink default)", () => {
    // NavLink only applies aria-current="page" when the router's path matches.
    renderWithRouter(
      <SidebarItem item={item} collapsed={false} isActive={true} />,
      { route: "/" },
    );
    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("truncates long labels via the truncate utility (FR-025)", () => {
    const longItem = { ...item, label: "A very very very very long navigation label" };
    renderWithRouter(
      <SidebarItem item={longItem} collapsed={false} isActive={false} />,
    );
    const label = document.querySelector("[data-slot='sidebar-item-label']");
    expect(label).not.toBeNull();
    expect(label!.className).toContain("truncate");
  });
});
