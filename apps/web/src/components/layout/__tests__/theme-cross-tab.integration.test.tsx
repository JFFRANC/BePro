import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, waitFor } from "@testing-library/react";
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
const mockedEmit = vi.mocked(emit);

describe("theme cross-tab sync (FR-020, SC-009)", () => {
  beforeEach(() => {
    clearThemeStorage();
    installMatchMediaMock({ systemIsDark: false });
    mockedEmit.mockReset();
  });

  afterEach(() => {
    cleanup();
    cleanupMatchMediaMock();
  });

  it("updates within 1s when another tab writes the preference (storage event)", async () => {
    renderWithTheme(<div data-testid="app" />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Simulate another tab writing the preference, then fire the storage event
    // that browsers natively dispatch to every other tab of the same origin.
    localStorage.setItem("bepro.theme", "dark");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "bepro.theme",
        newValue: "dark",
        oldValue: null,
        storageArea: localStorage,
      }),
    );

    await waitFor(
      () => {
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      },
      { timeout: 1000 },
    );
  });

  it("reverts when another tab switches back to light", async () => {
    localStorage.setItem("bepro.theme", "dark");
    renderWithTheme(<div data-testid="app" />);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    localStorage.setItem("bepro.theme", "light");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "bepro.theme",
        newValue: "light",
        oldValue: "dark",
        storageArea: localStorage,
      }),
    );

    await waitFor(
      () => {
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      },
      { timeout: 1000 },
    );
  });

  it("does NOT emit theme.change telemetry on cross-tab sync (contract §3)", async () => {
    renderWithTheme(<div data-testid="app" />);
    localStorage.setItem("bepro.theme", "dark");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "bepro.theme",
        newValue: "dark",
        oldValue: null,
        storageArea: localStorage,
      }),
    );
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
    // A sync from another tab must NOT re-emit the telemetry — the original
    // tab already emitted once. Double-counting across tabs would distort analytics.
    const themeChangeCalls = mockedEmit.mock.calls.filter(
      ([event]) => event && (event as { name: string }).name === "theme.change",
    );
    expect(themeChangeCalls).toEqual([]);
  });
});
