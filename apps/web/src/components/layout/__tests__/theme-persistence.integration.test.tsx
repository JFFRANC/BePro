import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, waitFor, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import {
  renderWithTheme,
  installMatchMediaMock,
  cleanupMatchMediaMock,
  clearThemeStorage,
} from "./theme-test-helpers";

function ThemeHarness() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme ?? ""}</span>
      <button data-testid="set-light" onClick={() => setTheme("light")}>
        light
      </button>
      <button data-testid="set-dark" onClick={() => setTheme("dark")}>
        dark
      </button>
    </div>
  );
}

describe("theme persistence & graceful storage (FR-008, FR-010, FR-017, SC-003, SC-008)", () => {
  beforeEach(() => {
    clearThemeStorage();
    installMatchMediaMock({ systemIsDark: false });
  });

  afterEach(() => {
    cleanup();
    cleanupMatchMediaMock();
    vi.restoreAllMocks();
  });

  it("hydrates from localStorage on mount", async () => {
    localStorage.setItem("bepro.theme", "dark");
    renderWithTheme(<ThemeHarness />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("writes the selected mode to localStorage under bepro.theme", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeHarness />);
    await user.click(screen.getByTestId("set-light"));
    await waitFor(() => {
      expect(localStorage.getItem("bepro.theme")).toBe("light");
    });
  });

  it("rehydrates on remount after clearing DOM class", async () => {
    localStorage.setItem("bepro.theme", "dark");
    const { unmount } = renderWithTheme(<ThemeHarness />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    unmount();
    document.documentElement.classList.remove("dark");
    renderWithTheme(<ThemeHarness />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("keeps working in-session when storage is blocked (private browsing) — no error surfaced", async () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    renderWithTheme(<ThemeHarness />);

    await user.click(screen.getByTestId("set-dark"));
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    // No role="alert" UI appeared, no console.error mentioning storage/theme.
    expect(document.querySelector('[role="alert"]')).toBeNull();
    const errorCalls = errorSpy.mock.calls.flat().filter((arg) => {
      const str = typeof arg === "string" ? arg : "";
      return (
        str.toLowerCase().includes("storage") ||
        str.toLowerCase().includes("theme") ||
        str.toLowerCase().includes("quota")
      );
    });
    expect(errorCalls).toEqual([]);

    setItemSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
