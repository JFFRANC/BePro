// Helper de test: convierte colores `oklch(L C H)` a sRGB y calcula la razon
// de contraste WCAG entre dos colores. Implementacion pura (sin dependencias).
//
// Referencias:
//  - OKLab/OKLCh -> linear sRGB: Bjorn Ottosson (https://bottosson.github.io/posts/oklab/)
//  - WCAG relative luminance: https://www.w3.org/TR/WCAG20-TECHS/G17.html

export interface LinearRgb {
  r: number;
  g: number;
  b: number;
}

// Parsea un string `oklch(L C H)` (con o sin porcentajes / `/ alpha`).
// Acepta L como 0..1 o como 0..100 seguido de `%`.
export function parseOklch(input: string): { L: number; C: number; H: number } {
  const trimmed = input.trim();
  const m = trimmed.match(/^oklch\(\s*([^\s,]+)\s+([^\s,]+)\s+([^\s,/)]+)(?:\s*\/\s*[^)]+)?\s*\)$/i);
  if (!m) {
    throw new Error(`contrastRatio: valor oklch invalido: ${input}`);
  }
  const parseMaybePercent = (raw: string, scale100: boolean): number => {
    if (raw.endsWith("%")) {
      return Number.parseFloat(raw.slice(0, -1)) / 100;
    }
    const v = Number.parseFloat(raw);
    return scale100 ? v : v;
  };
  const L = parseMaybePercent(m[1], true);
  const C = parseMaybePercent(m[2], false);
  const H = parseMaybePercent(m[3], false);
  if (Number.isNaN(L) || Number.isNaN(C) || Number.isNaN(H)) {
    throw new Error(`contrastRatio: componente oklch no numerico: ${input}`);
  }
  return { L, C, H };
}

// OKLCh -> OKLab
function oklchToOklab(L: number, C: number, H: number): [number, number, number] {
  const hRad = (H * Math.PI) / 180;
  return [L, C * Math.cos(hRad), C * Math.sin(hRad)];
}

// OKLab -> linear sRGB (valores pueden caer fuera de [0,1] si el color esta fuera de gamut).
function oklabToLinearRgb(L: number, a: number, b: number): LinearRgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

// Clampa al gamut sRGB (0..1). Para tests de contraste WCAG, clampar antes
// de calcular luminancia produce resultados estables incluso para colores
// marginalmente fuera de gamut.
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// Luminancia relativa WCAG (ya recibe linear sRGB).
function relativeLuminance(rgb: LinearRgb): number {
  const r = clamp01(rgb.r);
  const g = clamp01(rgb.g);
  const b = clamp01(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Razon de contraste WCAG entre dos colores oklch.
export function contrastRatio(fg: string, bg: string): number {
  const fgLch = parseOklch(fg);
  const bgLch = parseOklch(bg);
  const fgLab = oklchToOklab(fgLch.L, fgLch.C, fgLch.H);
  const bgLab = oklchToOklab(bgLch.L, bgLch.C, bgLch.H);
  const fgLin = oklabToLinearRgb(fgLab[0], fgLab[1], fgLab[2]);
  const bgLin = oklabToLinearRgb(bgLab[0], bgLab[1], bgLab[2]);
  const L1 = relativeLuminance(fgLin);
  const L2 = relativeLuminance(bgLin);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

// Umbrales WCAG AA.
export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE_OR_GLYPH = 3.0;
