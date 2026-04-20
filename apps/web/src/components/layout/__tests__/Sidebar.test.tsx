import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderWithRouter } from "./render-helpers";
import { useLayoutStore } from "@/store/layout-store";
import { Sidebar } from "../Sidebar";

describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ sidebarCollapsed: false, mobileDrawerOpen: false });
  });

  afterEach(() => cleanup());

  it("wraps navigation in a ScrollArea primitive", () => {
    const { container } = renderWithRouter(<Sidebar />);
    const scrollArea = container.querySelector("[data-slot='scroll-area']");
    expect(scrollArea).not.toBeNull();
  });

  it("is hidden on mobile viewports via responsive utilities", () => {
    const { container } = renderWithRouter(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside!.className).toContain("hidden");
    expect(aside!.className).toContain("md:flex");
  });

  it("applies the expanded width when sidebarCollapsed=false", () => {
    const { container } = renderWithRouter(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside!.getAttribute("data-collapsed")).toBe("false");
  });

  it("applies the collapsed width when sidebarCollapsed=true", () => {
    useLayoutStore.setState({ sidebarCollapsed: true });
    const { container } = renderWithRouter(<Sidebar />);
    const aside = container.querySelector("aside");
    expect(aside!.getAttribute("data-collapsed")).toBe("true");
  });

  it("renders the collapse button", () => {
    const { container } = renderWithRouter(<Sidebar />);
    const button = container.querySelector(
      "[data-slot='sidebar-collapse-button']",
    );
    expect(button).not.toBeNull();
  });

  it("applies w-60 when expanded and w-16 when collapsed", () => {
    const { container, rerender } = renderWithRouter(<Sidebar />);
    expect(container.querySelector("aside")!.className).toContain("w-60");
    useLayoutStore.setState({ sidebarCollapsed: true });
    rerender(<Sidebar />);
    expect(container.querySelector("aside")!.className).toContain("w-16");
  });

  it("places the nav inside the ScrollArea and renders a Separator before the footer", () => {
    const { container } = renderWithRouter(<Sidebar />);
    const scrollArea = container.querySelector("[data-slot='scroll-area']")!;
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(scrollArea.contains(nav!)).toBe(true);
    const separator = container.querySelector("[data-slot='separator']");
    expect(separator).not.toBeNull();
  });
});
