import { describe, expect, it } from "vitest";
import { contrastRatio, parseOklch } from "../contrastRatio";

// Tests del helper de contraste. Validamos contra valores WCAG conocidos.

describe("parseOklch", () => {
  it("parses a simple oklch string", () => {
    const parsed = parseOklch("oklch(0.55 0.16 225)");
    expect(parsed.L).toBeCloseTo(0.55, 5);
    expect(parsed.C).toBeCloseTo(0.16, 5);
    expect(parsed.H).toBeCloseTo(225, 5);
  });

  it("tolerates extra whitespace", () => {
    const parsed = parseOklch("oklch(  0.18   0.015   240 )");
    expect(parsed.L).toBeCloseTo(0.18, 5);
  });

  it("rejects malformed input", () => {
    expect(() => parseOklch("not-a-color")).toThrow();
    expect(() => parseOklch("oklch(0.5)")).toThrow();
  });
});

describe("contrastRatio", () => {
  it("returns ~21 for pure black vs pure white", () => {
    // oklch(1 0 0) ~ white, oklch(0 0 0) ~ black
    const ratio = contrastRatio("oklch(0 0 0)", "oklch(1 0 0)");
    expect(ratio).toBeGreaterThanOrEqual(20);
    expect(ratio).toBeLessThanOrEqual(21.1);
  });

  it("returns 1 for identical colors", () => {
    const ratio = contrastRatio("oklch(0.5 0.1 225)", "oklch(0.5 0.1 225)");
    expect(ratio).toBeCloseTo(1, 3);
  });

  it("is commutative (order of fg/bg does not matter)", () => {
    const a = contrastRatio("oklch(0.2 0.05 225)", "oklch(0.95 0.01 225)");
    const b = contrastRatio("oklch(0.95 0.01 225)", "oklch(0.2 0.05 225)");
    expect(a).toBeCloseTo(b, 5);
  });

  it("meets WCAG AA for a representative dark-on-light brand pair", () => {
    // Texto oscuro sobre fondo muy claro debe pasar 4.5:1.
    const ratio = contrastRatio("oklch(0.18 0.015 240)", "oklch(0.99 0.003 240)");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("meets WCAG AA for white text on a sufficiently-dark blueish primary", () => {
    // Verifica el helper contra un par conocido que DEBE pasar 4.5:1.
    // La eleccion final de `--primary` la decide la auditoria de contraste real (T015);
    // aqui solo validamos que el helper reporta correctamente.
    const ratio = contrastRatio("oklch(0.99 0 0)", "oklch(0.48 0.16 225)");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
