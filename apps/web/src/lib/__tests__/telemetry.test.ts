import { describe, it, expect, beforeEach, vi } from "vitest";
import { emit, type TelemetryEvent } from "@/lib/telemetry";

describe("emit (telemetry)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("never throws for any known event variant", () => {
    const events: TelemetryEvent[] = [
      { name: "nav.click", payload: { itemId: "candidates", path: "/candidates", source: "sidebar" } },
      { name: "sidebar.toggle", payload: { collapsed: true } },
      { name: "mobile-drawer.open", payload: {} },
      { name: "mobile-drawer.close", payload: { reason: "nav" } },
      { name: "theme.change", payload: { value: "dark" } },
      { name: "shortcut.use", payload: { key: "g d" } },
    ];
    for (const e of events) {
      expect(() => emit(e)).not.toThrow();
    }
  });

  it("logs via console.debug when running in DEV", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    emit({ name: "sidebar.toggle", payload: { collapsed: true } });
    expect(debugSpy).toHaveBeenCalled();
  });

  it("tolerates unknown event shapes defensively without throwing", () => {
    expect(() =>
      // @ts-expect-error intentional: verifying defensive behavior against future variants
      emit({ name: "unknown.event", payload: {} }),
    ).not.toThrow();
  });
});
