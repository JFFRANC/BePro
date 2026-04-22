import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const cssPath = path.resolve(__dirname, "../index.css");
const css = readFileSync(cssPath, "utf-8");

function extractTokens(selector: string): Set<string> {
  // Capture the first `{ … }` block following the selector at the top level.
  const pattern = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*\\{([\\s\\S]*?)\\n\\}`,
    "m",
  );
  const match = css.match(pattern);
  if (!match) return new Set();
  const body = match[1];
  const tokens = new Set<string>();
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(--[a-z0-9-]+)\s*:/i);
    if (m) tokens.add(m[1]);
  }
  return tokens;
}

// Typography, radius, and font-family tokens are intentionally mode-invariant;
// they only need to live under :root and are excluded from parity requirements.
const MODE_INVARIANT_PREFIXES = ["--font-", "--text-", "--radius"];

function isModeDependent(token: string): boolean {
  return !MODE_INVARIANT_PREFIXES.some((prefix) => token.startsWith(prefix));
}

describe("dark/light token parity (FR-015, FR-015a)", () => {
  const rootTokens = extractTokens(":root");
  const darkTokens = extractTokens("\\.dark");
  const rootColorTokens = new Set(
    [...rootTokens].filter((t) => isModeDependent(t)),
  );

  it(":root block exposes a non-empty set of tokens", () => {
    expect(rootTokens.size).toBeGreaterThan(0);
  });

  it(".dark block exposes a non-empty set of tokens", () => {
    expect(darkTokens.size).toBeGreaterThan(0);
  });

  it("every mode-dependent :root token has a .dark counterpart (FR-015a)", () => {
    const missing = [...rootColorTokens].filter((t) => !darkTokens.has(t));
    expect(
      missing,
      `Color/surface tokens missing from .dark block: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every .dark token has a :root counterpart (no orphan dark overrides)", () => {
    const missing = [...darkTokens].filter((t) => !rootTokens.has(t));
    expect(
      missing,
      `Tokens declared in .dark but absent from :root: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("mode-dependent token cardinality matches between :root and .dark", () => {
    expect(darkTokens.size).toBe(rootColorTokens.size);
  });
});
