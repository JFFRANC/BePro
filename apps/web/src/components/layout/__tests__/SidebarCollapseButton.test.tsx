import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter } from "./render-helpers";

vi.mock("@/lib/telemetry", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/telemetry")>("@/lib/telemetry");
  return { ...actual, emit: vi.fn() };
});

import { emit } from "@/lib/telemetry";
import { useLayoutStore } from "@/store/layout-store";
import { SidebarCollapseButton } from "../SidebarCollapseButton";

const mockedEmit = vi.mocked(emit);

describe("SidebarCollapseButton", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ sidebarCollapsed: false, mobileDrawerOpen: false });
    mockedEmit.mockReset();
  });

  afterEach(() => cleanup());

  it("reflects sidebarCollapsed=false via aria-expanded=true", () => {
    renderWithRouter(<SidebarCollapseButton />);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("toggles the store on click and flips aria-expanded", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SidebarCollapseButton />);
    const btn = screen.getByRole("button");
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
    await user.click(btn);
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    await user.click(btn);
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(false);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });

  it("has an accessible label that describes the action", () => {
    renderWithRouter(<SidebarCollapseButton />);
    const btn = screen.getByRole("button");
    const label = btn.getAttribute("aria-label") ?? btn.textContent ?? "";
    expect(label.length).toBeGreaterThan(0);
  });

  it("swaps chevron icon based on collapsed state", async () => {
    const user = userEvent.setup();
    const { container } = renderWithRouter(<SidebarCollapseButton />);
    const getSvg = () =>
      container.querySelector("[data-slot='sidebar-collapse-button'] svg");
    expect(getSvg()?.getAttribute("class") ?? "").toMatch(/chevron-left/);
    await user.click(container.querySelector("button")!);
    expect(getSvg()?.getAttribute("class") ?? "").toMatch(/chevron-right/);
  });

  it("emits sidebar.toggle telemetry on click", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SidebarCollapseButton />);
    await user.click(screen.getByRole("button"));
    expect(mockedEmit).toHaveBeenCalledWith({
      name: "sidebar.toggle",
      payload: { collapsed: true },
    });
  });
});
