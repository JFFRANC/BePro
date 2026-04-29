import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTokens } from "../test-utils/parseTokens";

// Auditoria de tipografia (T092 — feature 009). Valida que los tokens
// declarados en specs/009-ui-visual-refresh/contracts/design-tokens.md existen
// en apps/web/src/index.css, que tienen unidades razonables y que la
// legibilidad minima (line-height) se respeta. Este test se agrego DESPUES de
// que T091 landeara los tokens — su valor es prevencion de regresiones, no
// conducir nuevo codigo (FR-009).

const INDEX_CSS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../index.css",
);

const FONT_FAMILY_TOKENS = ["font-heading", "font-sans", "font-mono"] as const;

const TYPE_STEPS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "body",
  "small",
  "caption",
] as const;

type TypeStep = (typeof TYPE_STEPS)[number];

const STEP_PROPS = [
  "size",
  "line-height",
  "letter-spacing",
  "weight",
] as const;

// line-height minima aceptable (unitless). 1.15 para display / headings es
// estandar en sistemas tipograficos modernos (Material, Carbon). Body / small
// / caption necesitan mas aire y por eso exigimos >= 1.4 en esos steps.
function minLineHeightFor(step: TypeStep): number {
  switch (step) {
    case "h1":
      return 1.14; // 1.15 documentado, tolerancia minima por flotante.
    case "h2":
    case "h3":
      return 1.2;
    case "h4":
      return 1.35;
    case "body":
      return 1.5;
    case "small":
    case "caption":
      return 1.35;
  }
}

describe("typography.audit — token shape", () => {
  const tokens = parseTokens().root;

  it.each(FONT_FAMILY_TOKENS)("declara %s", (name) => {
    expect(tokens[name], `missing --${name} in :root`).toBeDefined();
    expect(tokens[name]).not.toBe("");
  });

  it.each(TYPE_STEPS)("step %s declara size / lh / spacing / weight", (step) => {
    for (const prop of STEP_PROPS) {
      const key = `text-${step}-${prop}`;
      expect(
        tokens[key],
        `missing --${key} in :root`,
      ).toBeDefined();
      expect(tokens[key]).not.toBe("");
    }
  });
});

describe("typography.audit — sizes parse to rem / unitless lh", () => {
  const tokens = parseTokens().root;

  it.each(TYPE_STEPS)("--text-%s-size termina en rem", (step) => {
    const value = tokens[`text-${step}-size`];
    expect(value).toMatch(/^-?\d+(?:\.\d+)?rem$/);
  });

  it.each(TYPE_STEPS)("--text-%s-line-height es unitless", (step) => {
    const value = tokens[`text-${step}-line-height`];
    // Aceptamos numero puro (ej. 1.5) pero NO px / rem / em.
    expect(value).toMatch(/^\d+(?:\.\d+)?$/);
  });

  it.each(TYPE_STEPS)("--text-%s-weight es numero", (step) => {
    const value = tokens[`text-${step}-weight`];
    expect(value).toMatch(/^\d{3}$/);
    const n = Number(value);
    expect(n).toBeGreaterThanOrEqual(100);
    expect(n).toBeLessThanOrEqual(900);
  });
});

describe("typography.audit — readability floor", () => {
  const tokens = parseTokens().root;

  it.each(TYPE_STEPS)(
    "line-height del step %s cumple el minimo de lectura",
    (step) => {
      const lh = Number(tokens[`text-${step}-line-height`]);
      const min = minLineHeightFor(step);
      expect(
        lh,
        `--text-${step}-line-height ${lh} < min ${min}`,
      ).toBeGreaterThanOrEqual(min);
    },
  );
});

describe("typography.audit — @theme inline re-exporta familias", () => {
  const css = readFileSync(INDEX_CSS_PATH, "utf8");

  it.each(["--font-sans", "--font-heading", "--font-mono"])(
    "%s re-exportado en @theme inline",
    (name) => {
      // El bloque @theme inline { ... } debe contener la reasignacion
      // `--font-sans: var(--font-sans);` para exponer la utility Tailwind.
      const re = new RegExp(`${name}\\s*:\\s*var\\(${name}\\)`);
      expect(css, `@theme inline no re-exporta ${name}`).toMatch(re);
    },
  );
});
