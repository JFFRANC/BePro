import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithTheme,
  installMatchMediaMock,
  cleanupMatchMediaMock,
  clearThemeStorage,
} from "./theme-test-helpers";

vi.mock("@/lib/telemetry", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/telemetry")>("@/lib/telemetry");
  return { ...actual, emit: vi.fn() };
});

import { emit } from "@/lib/telemetry";
import { ThemeToggle } from "../ThemeToggle";

const mockedEmit = vi.mocked(emit);

describe("ThemeToggle", () => {
  beforeEach(() => {
    clearThemeStorage();
    installMatchMediaMock({ systemIsDark: false });
    mockedEmit.mockReset();
  });

  afterEach(() => {
    cleanup();
    cleanupMatchMediaMock();
  });

  it("renders the trigger with a Spanish accessible label", () => {
    renderWithTheme(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: /tema/i });
    expect(trigger.getAttribute("data-slot")).toBe("theme-toggle-trigger");
  });

  it("trigger reflects closed state via aria-expanded=false", () => {
    renderWithTheme(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: /tema/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("opens a menu with three options labeled Claro, Oscuro, Sistema", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /tema/i }));
    await waitFor(() => {
      expect(screen.getByText("Claro")).toBeTruthy();
    });
    expect(screen.getByText("Oscuro")).toBeTruthy();
    expect(screen.getByText("Sistema")).toBeTruthy();
  });

  it("menu options carry role=menuitemradio with aria-checked reflecting selection", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />, { defaultMode: "system" });
    await user.click(screen.getByRole("button", { name: /tema/i }));
    await waitFor(() => screen.getByRole("menuitemradio", { name: "Sistema" }));
    const items = screen.getAllByRole("menuitemradio");
    expect(items).toHaveLength(3);
    const system = items.find((el) => el.textContent?.includes("Sistema"));
    expect(system?.getAttribute("aria-checked")).toBe("true");
    const claro = items.find((el) => el.textContent?.includes("Claro"));
    expect(claro?.getAttribute("aria-checked")).toBe("false");
  });

  it("selecting an option emits telemetry with the correct value", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />, { defaultMode: "system" });
    await user.click(screen.getByRole("button", { name: /tema/i }));
    await waitFor(() => screen.getByRole("menuitemradio", { name: "Oscuro" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Oscuro" }));
    expect(mockedEmit).toHaveBeenCalledWith({
      name: "theme.change",
      payload: { value: "dark" },
    });
    expect(mockedEmit).toHaveBeenCalledTimes(1);
  });

  it("shows a Sun icon when resolvedTheme is light", () => {
    const { container } = renderWithTheme(<ThemeToggle />, {
      defaultMode: "light",
    });
    const svg = container.querySelector(
      "[data-slot='theme-toggle-trigger'] svg",
    );
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("class")).toMatch(/lucide-sun/);
  });

  it("shows a Moon icon when resolvedTheme is dark", () => {
    const { container } = renderWithTheme(<ThemeToggle />, {
      defaultMode: "dark",
    });
    const svg = container.querySelector(
      "[data-slot='theme-toggle-trigger'] svg",
    );
    expect(svg!.getAttribute("class")).toMatch(/lucide-moon/);
  });

  it("shows a Monitor icon when theme is system", () => {
    const { container } = renderWithTheme(<ThemeToggle />, {
      defaultMode: "system",
    });
    const svg = container.querySelector(
      "[data-slot='theme-toggle-trigger'] svg",
    );
    expect(svg!.getAttribute("class")).toMatch(/lucide-monitor/);
  });

  it("trigger flips aria-expanded to true after opening", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: /tema/i });
    await user.click(trigger);
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("menu uses role=menu on its container (FR-019)", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /tema/i }));
    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeTruthy();
    });
  });

  it("menu closes after selecting an option", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />, { defaultMode: "system" });
    const trigger = screen.getByRole("button", { name: /tema/i });
    await user.click(trigger);
    await waitFor(() => screen.getByRole("menuitemradio", { name: "Claro" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Claro" }));
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  it("keeps the Monitor icon when theme=system during an OS palette flip (FR-003)", async () => {
    const { installMatchMediaMock, dispatchSystemThemeChange } =
      await import("./theme-test-helpers");
    installMatchMediaMock({ systemIsDark: true });
    const { container } = renderWithTheme(<ThemeToggle />, {
      defaultMode: "system",
    });
    const initialIcon = container.querySelector(
      "[data-slot='theme-toggle-trigger'] svg",
    );
    expect(initialIcon!.getAttribute("class")).toMatch(/lucide-monitor/);
    dispatchSystemThemeChange(false);
    await waitFor(() => {
      const nowIcon = container.querySelector(
        "[data-slot='theme-toggle-trigger'] svg",
      );
      // Still Monitor — the mode hasn't changed, only the resolved palette.
      expect(nowIcon!.getAttribute("class")).toMatch(/lucide-monitor/);
    });
  });

  it("does not throw when mounted without a NextThemesProvider (resilience)", async () => {
    const { render } = await import("@testing-library/react");
    const { MemoryRouter } = await import("react-router-dom");
    const { TooltipProvider } = await import("@/components/ui/tooltip");
    // Bare tree — no NextThemesProvider.
    expect(() =>
      render(
        <MemoryRouter>
          <TooltipProvider>
            <ThemeToggle />
          </TooltipProvider>
        </MemoryRouter>,
      ),
    ).not.toThrow();
    // Default fallback icon is Sun (resolvedTheme/theme both undefined).
    const svg = document.querySelector(
      "[data-slot='theme-toggle-trigger'] svg",
    );
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("class")).toMatch(/lucide-sun/);
  });
});
