import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseOklch } from "./test-utils";

const rawCss = readFileSync(
  resolve(__dirname, "../index.css"),
  "utf-8",
);

describe("US1 — Brand Identity & Color Tokens", () => {
  it("T011: --primary resolves to a blueish OKLch value (feature 009 identity)", () => {
    // Feature 003 defined la identidad como teal (H:150-200). Feature 009
    // cambia intencionalmente la identidad a azul (H:210-240). Este test
    // valida la nueva verdad del producto.
    const rootBlock = rawCss.match(/:root\s*\{([^}]+)\}/s);
    expect(rootBlock).not.toBeNull();
    const primaryMatch = rootBlock![1].match(
      /--primary:\s*(oklch\([^)]+\))/,
    );
    expect(primaryMatch).not.toBeNull();
    const parsed = parseOklch(primaryMatch![1]);
    expect(parsed).not.toBeNull();
    expect(parsed!.c).toBeGreaterThan(0);
    expect(parsed!.h).toBeGreaterThanOrEqual(210);
    expect(parsed!.h).toBeLessThanOrEqual(240);
  });

  it("T012: all semantic tokens have non-zero chroma in both :root and .dark", () => {
    const tokens = [
      "--primary",
      "--secondary",
      "--destructive",
      "--muted",
      "--accent",
      "--success",
      "--warning",
      "--info",
    ];

    const rootBlock = rawCss.match(/:root\s*\{([^}]+)\}/s)![1];
    const darkBlock = rawCss.match(/\.dark\s*\{([^}]+)\}/s)![1];

    for (const token of tokens) {
      const rootMatch = rootBlock.match(
        new RegExp(`${token}:\\s*(oklch\\([^)]+\\))`),
      );
      expect(rootMatch, `${token} missing in :root`).not.toBeNull();
      const rootParsed = parseOklch(rootMatch![1]);
      expect(rootParsed, `${token} not valid oklch in :root`).not.toBeNull();
      expect(
        rootParsed!.c,
        `${token} has zero chroma in :root`,
      ).toBeGreaterThan(0);

      const darkMatch = darkBlock.match(
        new RegExp(`${token}:\\s*(oklch\\([^)]+\\))`),
      );
      expect(darkMatch, `${token} missing in .dark`).not.toBeNull();
      const darkParsed = parseOklch(darkMatch![1]);
      expect(darkParsed, `${token} not valid oklch in .dark`).not.toBeNull();
      expect(
        darkParsed!.c,
        `${token} has zero chroma in .dark`,
      ).toBeGreaterThan(0);
    }
  });

  it("T013: dark mode tokens differ from light mode tokens", () => {
    const rootBlock = rawCss.match(/:root\s*\{([^}]+)\}/s)![1];
    const darkBlock = rawCss.match(/\.dark\s*\{([^}]+)\}/s)![1];

    const getVal = (block: string, token: string) =>
      block.match(new RegExp(`${token}:\\s*(oklch\\([^)]+\\))`))?.[1];

    const tokens = ["--primary", "--background", "--foreground", "--card"];
    for (const token of tokens) {
      const rootVal = getVal(rootBlock, token);
      const darkVal = getVal(darkBlock, token);
      expect(rootVal, `${token} missing in :root`).toBeDefined();
      expect(darkVal, `${token} missing in .dark`).toBeDefined();
      expect(rootVal).not.toBe(darkVal);
    }
  });

  it("T014: --destructive-foreground exists in both :root and .dark", () => {
    const rootBlock = rawCss.match(/:root\s*\{([^}]+)\}/s)![1];
    const darkBlock = rawCss.match(/\.dark\s*\{([^}]+)\}/s)![1];

    expect(rootBlock).toContain("--destructive-foreground:");
    expect(darkBlock).toContain("--destructive-foreground:");
  });

  it("T015: contrast — lightness delta >= 0.40 for all foreground/background pairs", () => {
    const rootBlock = rawCss.match(/:root\s*\{([^}]+)\}/s)![1];

    const pairs = [
      ["--primary", "--primary-foreground"],
      ["--secondary", "--secondary-foreground"],
      ["--destructive", "--destructive-foreground"],
      ["--muted", "--muted-foreground"],
      ["--accent", "--accent-foreground"],
      ["--success", "--success-foreground"],
      ["--warning", "--warning-foreground"],
      ["--info", "--info-foreground"],
    ];

    for (const [bg, fg] of pairs) {
      const bgMatch = rootBlock.match(
        new RegExp(`${bg}:\\s*(oklch\\([^)]+\\))`),
      );
      const fgMatch = rootBlock.match(
        new RegExp(`${fg}:\\s*(oklch\\([^)]+\\))`),
      );
      expect(bgMatch, `${bg} not found in :root`).not.toBeNull();
      expect(fgMatch, `${fg} not found in :root`).not.toBeNull();

      const bgL = parseOklch(bgMatch![1])!.l;
      const fgL = parseOklch(fgMatch![1])!.l;
      const delta = Math.abs(fgL - bgL);
      expect(
        delta,
        `${bg}/${fg} lightness delta ${delta.toFixed(3)} < 0.40`,
      ).toBeGreaterThanOrEqual(0.40);
    }
  });

  it("T016: >= 8 perceptually uniform neutral/surface gray steps", () => {
    const rootBlock = rawCss.match(/:root\s*\{([^}]+)\}/s)![1];
    const surfaceTokens = [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--muted",
      "--muted-foreground",
      "--border",
      "--input",
      "--sidebar",
      "--sidebar-foreground",
      "--popover",
      "--popover-foreground",
    ];

    const lightnessValues = new Set<number>();
    for (const token of surfaceTokens) {
      const match = rootBlock.match(
        new RegExp(`${token}:\\s*(oklch\\([^)]+\\))`),
      );
      if (match) {
        const parsed = parseOklch(match[1]);
        if (parsed) {
          lightnessValues.add(Math.round(parsed.l * 100) / 100);
        }
      }
    }

    expect(
      lightnessValues.size,
      `Only ${lightnessValues.size} distinct lightness values found`,
    ).toBeGreaterThanOrEqual(8);
  });
});

describe("US2 — Typography System", () => {
  it("T019: --font-heading contains Fraunces and --font-sans contains Source Sans 3", () => {
    const rootBlock = rawCss.match(/:root\s*\{([^}]+)\}/s)![1];

    const headingMatch = rootBlock.match(/--font-heading:\s*([^;]+);/);
    expect(headingMatch).not.toBeNull();
    expect(headingMatch![1]).toContain("Fraunces");

    const sansMatch = rootBlock.match(/--font-sans:\s*([^;]+);/);
    expect(sansMatch).not.toBeNull();
    expect(sansMatch![1]).toContain("Source Sans 3");
  });

  it("T020: @theme inline maps --font-heading for Tailwind utility", () => {
    const themeBlock = rawCss.match(/@theme inline\s*\{([^}]+)\}/s);
    expect(themeBlock).not.toBeNull();
    expect(themeBlock![1]).toContain("--font-heading: var(--font-heading)");
  });
});
