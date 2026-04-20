import { describe, it, expect, beforeEach, vi } from "vitest";
import { safeLocalStorage } from "@/lib/safe-storage";

describe("safeLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("writes and reads back a value", () => {
    safeLocalStorage.setItem("k", "v");
    expect(safeLocalStorage.getItem("k")).toBe("v");
  });

  it("returns null for an absent key", () => {
    expect(safeLocalStorage.getItem("missing")).toBeNull();
  });

  it("removes a value", () => {
    safeLocalStorage.setItem("k", "v");
    safeLocalStorage.removeItem("k");
    expect(safeLocalStorage.getItem("k")).toBeNull();
  });

  it("no-ops when setItem throws (private browsing)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => safeLocalStorage.setItem("k", "v")).not.toThrow();
  });

  it("returns null when getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(safeLocalStorage.getItem("k")).toBeNull();
  });

  it("swallows errors from removeItem", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => safeLocalStorage.removeItem("k")).not.toThrow();
  });
});
