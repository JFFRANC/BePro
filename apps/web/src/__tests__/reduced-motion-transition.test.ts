import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const cssPath = path.resolve(__dirname, "../index.css");
const css = readFileSync(cssPath, "utf-8");

function extractMediaBlock(query: string): string | null {
  // Match `@media (query) { ... }` with balanced braces (one level deep).
  const needle = `@media (${query})`;
  const start = css.indexOf(needle);
  if (start === -1) return null;
  const braceStart = css.indexOf("{", start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < css.length; i++) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(braceStart + 1, i);
    }
  }
  return null;
}

describe("reduced-motion palette transition (FR-016)", () => {
  const block = extractMediaBlock("prefers-reduced-motion: no-preference");

  it("index.css contains a @media (prefers-reduced-motion: no-preference) block", () => {
    expect(block).not.toBeNull();
  });

  it("transitions include background-color, color, border-color, fill, stroke", () => {
    const lower = (block ?? "").toLowerCase();
    for (const prop of [
      "background-color",
      "color",
      "border-color",
      "fill",
      "stroke",
    ]) {
      expect(lower).toContain(prop);
    }
  });

  it("every duration inside the block is > 0ms and ≤ 200ms", () => {
    expect(block).not.toBeNull();
    const durations = Array.from(block!.matchAll(/(\d+)\s*ms/g)).map((m) =>
      Number(m[1]),
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) {
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThanOrEqual(200);
    }
  });

  it("no color-related transition declared outside the reduced-motion guard", () => {
    // Remove the entire @media block we found and scan remaining CSS.
    const needle = `@media (prefers-reduced-motion: no-preference)`;
    const start = css.indexOf(needle);
    let remainder = css;
    if (start !== -1) {
      const braceStart = css.indexOf("{", start);
      let depth = 0;
      for (let i = braceStart; i < css.length; i++) {
        if (css[i] === "{") depth += 1;
        else if (css[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            remainder = css.slice(0, start) + css.slice(i + 1);
            break;
          }
        }
      }
    }
    // Allow transition of non-color properties (transform, opacity) outside.
    // Disallow explicit transitions on background-color / color / border-color
    // / fill / stroke outside the guard.
    const forbidden = /transition:[^;]*\b(background-color|color|border-color|fill|stroke)\b/gi;
    const matches = remainder.match(forbidden);
    expect(
      matches,
      `Color-related transition found outside @media guard: ${matches?.join(
        " | ",
      )}`,
    ).toBeNull();
  });
});
