import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, waitFor, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import {
  renderWithTheme,
  installMatchMediaMock,
  cleanupMatchMediaMock,
  clearThemeStorage,
  dispatchSystemThemeChange,
} from "./theme-test-helpers";

vi.mock("@/lib/telemetry", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/telemetry")>("@/lib/telemetry");
  return { ...actual, emit: vi.fn() };
});

import { emit } from "@/lib/telemetry";
const mockedEmit = vi.mocked(emit);

function ThemeHarness() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme ?? ""}</span>
      <span data-testid="resolved">{resolvedTheme ?? ""}</span>
      <button onClick={() => setTheme("dark")}>force-dark</button>
    </div>
  );
}

describe("theme OS follow (FR-005, FR-006, FR-007, SC-007)", () => {
  beforeEach(() => {
    clearThemeStorage();
    mockedEmit.mockReset();
  });

  afterEach(() => {
    cleanup();
    cleanupMatchMediaMock();
  });

  it("paints dark on first visit when OS is dark (empty storage, mode=system)", async () => {
    installMatchMediaMock({ systemIsDark: true });
    renderWithTheme(<ThemeHarness />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("paints light on first visit when OS is light (empty storage, mode=system)", async () => {
    installMatchMediaMock({ systemIsDark: false });
    renderWithTheme(<ThemeHarness />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  it("follows live OS change when mode is system", async () => {
    installMatchMediaMock({ systemIsDark: true });
    renderWithTheme(<ThemeHarness />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    dispatchSystemThemeChange(false);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  it("ignores OS change when user has chosen an explicit mode (FR-007)", async () => {
    installMatchMediaMock({ systemIsDark: true });
    renderWithTheme(<ThemeHarness />, { defaultMode: "dark" });
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    dispatchSystemThemeChange(false);
    await new Promise((r) => setTimeout(r, 50));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does NOT emit theme.change telemetry on OS live-follow (contract §3)", async () => {
    installMatchMediaMock({ systemIsDark: true });
    renderWithTheme(<ThemeHarness />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    // OS flip is NOT a user action — telemetry must stay quiet.
    dispatchSystemThemeChange(false);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
    const themeChangeCalls = mockedEmit.mock.calls.filter(
      ([event]) => event && (event as { name: string }).name === "theme.change",
    );
    expect(themeChangeCalls).toEqual([]);
  });
});
