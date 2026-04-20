import { describe, it, expect } from "vitest";
import { resolveActiveItem, type ActiveMatchItem } from "@/lib/active-match";

const items: ActiveMatchItem[] = [
  { id: "dashboard", path: "/", exactMatch: true },
  { id: "candidates", path: "/candidates" },
  { id: "candidate-new", path: "/candidates/new" },
  { id: "users", path: "/users" },
];

describe("resolveActiveItem", () => {
  it("matches the root exactly when exactMatch is true", () => {
    expect(resolveActiveItem("/", items)).toBe("dashboard");
  });

  it("does not use dashboard for a non-root path despite shared prefix", () => {
    expect(resolveActiveItem("/candidates", items)).toBe("candidates");
  });

  it("prefix-matches a child route", () => {
    expect(resolveActiveItem("/candidates/123", items)).toBe("candidates");
  });

  it("prefix-matches a deep child route", () => {
    expect(resolveActiveItem("/candidates/123/edit", items)).toBe("candidates");
  });

  it("picks the longest matching prefix when multiple items match", () => {
    expect(resolveActiveItem("/candidates/new/step-2", items)).toBe("candidate-new");
  });

  it("treats a trailing slash as equivalent to no trailing slash", () => {
    expect(resolveActiveItem("/candidates/", items)).toBe("candidates");
  });

  it("ignores the query string", () => {
    expect(resolveActiveItem("/users/abc?tab=audit", items)).toBe("users");
  });

  it("ignores the hash fragment", () => {
    expect(resolveActiveItem("/candidates#top", items)).toBe("candidates");
  });

  it("returns null when no item matches", () => {
    expect(resolveActiveItem("/something-unknown", items)).toBeNull();
  });

  it("returns null for an empty pathname", () => {
    expect(resolveActiveItem("", items)).toBeNull();
  });
});
