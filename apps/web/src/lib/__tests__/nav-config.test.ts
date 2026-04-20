import { describe, it, expect } from "vitest";
import { NAV_CONFIG } from "@/lib/nav-config";

function allItems() {
  return NAV_CONFIG.flatMap((g) => g.items);
}

describe("NAV_CONFIG", () => {
  it("every item path starts with '/'", () => {
    for (const item of allItems()) {
      expect(item.path.startsWith("/")).toBe(true);
    }
  });

  it("every item id is unique across all groups", () => {
    const ids = allItems().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every group id is unique", () => {
    const gids = NAV_CONFIG.map((g) => g.id);
    expect(new Set(gids).size).toBe(gids.length);
  });

  it("every item declares a truthy icon", () => {
    for (const item of allItems()) {
      expect(item.icon).toBeTruthy();
    }
  });

  it("is frozen at the top level", () => {
    expect(Object.isFrozen(NAV_CONFIG)).toBe(true);
  });

  it("contains the eleven expected item ids", () => {
    const ids = allItems()
      .map((i) => i.id)
      .sort();
    expect(ids).toEqual(
      [
        "audit",
        "candidates",
        "clients",
        "contacts",
        "dashboard",
        "design-system",
        "interviews",
        "job-openings",
        "placements",
        "settings",
        "users",
      ].sort(),
    );
  });
});
