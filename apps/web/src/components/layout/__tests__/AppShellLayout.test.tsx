import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLayoutStore } from "@/store/layout-store";

vi.mock("@/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "u1",
      email: "x@x.com",
      firstName: "Ada",
      lastName: "Lovelace",
      role: "admin",
      tenantId: "tenant-bepro",
      isFreelancer: false,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

import { AppShellLayout } from "../AppShellLayout";

function renderShellAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TooltipProvider>
        <Routes>
          <Route element={<AppShellLayout />}>
            <Route path="/" element={<div data-testid="dash">DASH</div>} />
            <Route path="/users" element={<div data-testid="users">USERS</div>} />
          </Route>
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  );
}

describe("AppShellLayout", () => {
  beforeEach(() => {
    localStorage.clear();
    useLayoutStore.setState({ sidebarCollapsed: false, mobileDrawerOpen: false });
  });

  afterEach(() => cleanup());

  it("renders header, sidebar and main with the current route's Outlet content", () => {
    const { container } = renderShellAt("/");
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector("aside")).not.toBeNull();
    const main = container.querySelector("main#main");
    expect(main).not.toBeNull();
    expect(screen.getByTestId("dash")).not.toBeNull();
  });

  it("renders header + sidebar consistently on every protected route", () => {
    const { container: dashContainer } = renderShellAt("/");
    expect(dashContainer.querySelector("header")).not.toBeNull();
    expect(dashContainer.querySelector("aside")).not.toBeNull();
    expect(screen.getByTestId("dash")).not.toBeNull();
    cleanup();
    const { container: usersContainer } = renderShellAt("/users");
    expect(usersContainer.querySelector("header")).not.toBeNull();
    expect(usersContainer.querySelector("aside")).not.toBeNull();
    expect(screen.getByTestId("users")).not.toBeNull();
  });

  it("renders SkipToContent as the first focusable element", () => {
    const { container } = renderShellAt("/");
    const firstLink = container.querySelector("a");
    expect(firstLink).not.toBeNull();
    expect(firstLink!.getAttribute("href")).toBe("#main");
  });

  it("main content is capped at max-w-screen-2xl and centered", () => {
    const { container } = renderShellAt("/");
    const main = container.querySelector("main#main");
    expect(main).not.toBeNull();
    const inner = main!.querySelector("[data-slot='main-inner']") ?? main;
    expect(inner!.className).toContain("max-w-screen-2xl");
    expect(inner!.className).toContain("mx-auto");
  });

  it("persists sidebarCollapsed across unmount + remount", () => {
    const { unmount } = renderShellAt("/");
    useLayoutStore.getState().setSidebarCollapsed(true);
    unmount();
    cleanup();
    renderShellAt("/");
    expect(useLayoutStore.getState().sidebarCollapsed).toBe(true);
  });

  it("SkipToContent is the first focusable element in tab order (FR-021)", () => {
    const { container } = renderShellAt("/");
    const focusables = container.querySelectorAll<HTMLElement>(
      "a, button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    expect(focusables.length).toBeGreaterThan(0);
    expect(focusables[0].getAttribute("href")).toBe("#main");
  });

  it("main has tabIndex=-1 so skip-to-content can focus it programmatically", () => {
    const { container } = renderShellAt("/");
    const main = container.querySelector("main#main");
    expect(main!.getAttribute("tabindex")).toBe("-1");
  });

  it("includes its own TooltipProvider so consumers don't have to supply one", () => {
    // Render the shell with a bare MemoryRouter — no outer TooltipProvider.
    // If AppShellLayout did not mount one, rendering a sidebar item that uses
    // tooltip context would throw; reaching the assertion proves self-sufficiency.
    const result = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<AppShellLayout />}>
            <Route path="/" element={<div data-testid="ok">OK</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(result.getByTestId("ok")).not.toBeNull();
    expect(result.container.querySelector("aside")).not.toBeNull();
  });

  it("renders when useAuth returns a null user (no crash) — FR-030 spirit", async () => {
    const { useAuth } = await import("@/modules/auth/hooks/useAuth");
    vi.mocked(useAuth).mockReturnValueOnce({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    const { container } = renderShellAt("/");
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector("main#main")).not.toBeNull();
  });
});
