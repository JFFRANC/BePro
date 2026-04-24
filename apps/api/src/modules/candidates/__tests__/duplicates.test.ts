import { describe, it, expect } from "vitest";
import { normalizePhone } from "../duplicates.js";

describe("normalizePhone (R2)", () => {
  it("strips spaces, dashes, parens, dots, and the leading +country", () => {
    expect(normalizePhone("+52 55 1234 5678")).toBe("5512345678");
    expect(normalizePhone("(55) 1234-5678")).toBe("5512345678");
    expect(normalizePhone("55.1234.5678")).toBe("5512345678");
    expect(normalizePhone("5512345678")).toBe("5512345678");
    expect(normalizePhone("+1 (415) 555-2671")).toBe("4155552671");
  });

  it("keeps a number that has no country code as-is", () => {
    expect(normalizePhone("4421112233")).toBe("4421112233");
  });

  it("normalizes empty/garbage strings to empty", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("---")).toBe("");
    expect(normalizePhone("not a phone")).toBe("");
  });

  it("treats two equivalent representations as equal after normalization", () => {
    expect(normalizePhone("+52 55-1234 5678")).toBe(
      normalizePhone("(52) 5512345678"),
    );
  });
});
