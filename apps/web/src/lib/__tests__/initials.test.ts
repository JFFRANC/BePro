import { describe, it, expect } from "vitest";
import { getInitials } from "@/lib/initials";

describe("getInitials", () => {
  it("uses the first letter of the first and last name", () => {
    expect(getInitials("Hector", "Franco")).toBe("HF");
  });

  it("falls back to the first letter of first name when last name is empty", () => {
    expect(getInitials("Hector", "")).toBe("H");
  });

  it("returns an empty string for empty input", () => {
    expect(getInitials("", "")).toBe("");
  });

  it("preserves accented characters", () => {
    expect(getInitials("Ángela", "Óscar")).toBe("ÁÓ");
  });

  it("uppercases lowercase input", () => {
    expect(getInitials("jane", "doe")).toBe("JD");
  });

  it("trims leading/trailing whitespace", () => {
    expect(getInitials("  ana  ", "  b  ")).toBe("AB");
  });
});
