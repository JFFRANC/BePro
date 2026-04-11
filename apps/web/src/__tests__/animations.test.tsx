import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const rawCss = readFileSync(
  resolve(__dirname, "../index.css"),
  "utf-8",
);

describe("US5 — Animation & Motion", () => {
  it("T045: tw-animate-css is imported for animation utilities", () => {
    expect(rawCss).toContain('@import "tw-animate-css"');
  });

  it("T046: prefers-reduced-motion media query disables animations", () => {
    expect(rawCss).toContain("prefers-reduced-motion: reduce");
    expect(rawCss).toContain("animation-duration: 0.01ms !important");
    expect(rawCss).toContain("animation-iteration-count: 1 !important");
    expect(rawCss).toContain("transition-duration: 0.01ms !important");
  });
});
