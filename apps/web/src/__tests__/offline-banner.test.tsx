import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { OfflineBanner } from "@/components/offline-banner";

describe("OfflineBanner", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, "onLine", { value: originalOnLine, writable: true, configurable: true });
  });

  it("does not render when online", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
    render(<OfflineBanner />);
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });

  it("renders warning banner when offline", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
    render(<OfflineBanner />);
    expect(screen.getByText(/Sin conexión/)).toBeDefined();
  });

  it("shows banner when going offline via event", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true, configurable: true });
    render(<OfflineBanner />);
    expect(screen.queryByText(/Sin conexión/)).toBeNull();

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, writable: true, configurable: true });
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/Sin conexión/)).toBeDefined();
  });
});
