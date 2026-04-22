import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const htmlPath = path.resolve(__dirname, "../../index.html");
const html = readFileSync(htmlPath, "utf-8");

function findInlineScripts(): string[] {
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  return Array.from(html.matchAll(pattern), (m) => m[1]);
}

function headSlice(): string {
  const m = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : "";
}

describe("index.html inline no-flash script (FR-009, FR-017, SC-002)", () => {
  const inlineScripts = findInlineScripts();
  const headContent = headSlice();
  const noFlashScript = inlineScripts.find(
    (s) => s.includes("bepro.theme") && s.includes("classList"),
  );

  it("has an inline <script> inside <head>", () => {
    expect(inlineScripts.length).toBeGreaterThan(0);
    expect(headContent).toContain("<script");
  });

  it("inline script appears before any <script src=...> tag", () => {
    const firstInline = html.search(
      /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i,
    );
    const firstSrc = html.search(/<script[^>]*\bsrc=/i);
    expect(firstInline).toBeGreaterThan(-1);
    if (firstSrc !== -1) {
      expect(firstInline).toBeLessThan(firstSrc);
    }
  });

  it("reads localStorage.getItem('bepro.theme')", () => {
    expect(noFlashScript).toBeDefined();
    expect(noFlashScript!).toMatch(/localStorage\.getItem\(["']bepro\.theme["']\)/);
  });

  it("checks matchMedia('(prefers-color-scheme: dark)')", () => {
    expect(noFlashScript!).toMatch(
      /matchMedia\(["']\(prefers-color-scheme:\s*dark\)["']\)/,
    );
  });

  it("adds 'dark' to document.documentElement.classList conditionally", () => {
    expect(noFlashScript!).toMatch(
      /document\.documentElement\.classList\.add\(["']dark["']\)/,
    );
  });

  it("wraps the body in try/catch for private-browsing safety", () => {
    expect(noFlashScript!).toMatch(/try\s*\{/);
    expect(noFlashScript!).toMatch(/catch\s*\(/);
  });
});
