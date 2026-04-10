import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const rawCss = readFileSync(
  resolve(__dirname, "../index.css"),
  "utf-8",
);

describe("US6 — Layout Patterns", () => {
  it("T060: auth layout utility defines a two-column grid at lg breakpoint", () => {
    expect(rawCss).toContain("auth-layout");
    expect(rawCss).toContain("2fr");
    expect(rawCss).toContain("3fr");
  });

  it("T061: dashboard layout utility defines sidebar + content grid", () => {
    expect(rawCss).toContain("dashboard-layout");
    expect(rawCss).toContain("16rem");
  });
});
