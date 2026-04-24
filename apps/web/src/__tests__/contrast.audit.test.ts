import { describe, expect, it } from "vitest";
import { parseTokens } from "../test-utils/parseTokens";
import {
  contrastRatio,
  parseOklch,
  WCAG_AA_LARGE_OR_GLYPH,
  WCAG_AA_NORMAL,
} from "../test-utils/contrastRatio";

// Auditoria de contraste WCAG AA para la paleta definida en
// specs/009-ui-visual-refresh/contracts/design-tokens.md.
//
// Este test recorre los pares foreground/background documentados y exige:
//  - 4.5:1 para texto normal
//  - 3.0:1 para UI glyphs / bordes / anillos de focus

// Pares documentados: [nombreFg, nombreBg, ratioMinimo, rol]
type ContrastPair = [string, string, number, string];

const REQUIRED_PAIRS: ContrastPair[] = [
  // Texto primario
  ["foreground", "background", WCAG_AA_NORMAL, "body text"],
  ["card-foreground", "card", WCAG_AA_NORMAL, "card text"],
  ["popover-foreground", "popover", WCAG_AA_NORMAL, "popover text"],
  ["muted-foreground", "muted", WCAG_AA_NORMAL, "muted text on muted surface"],
  ["muted-foreground", "background", WCAG_AA_NORMAL, "muted text on page bg"],
  // Brand / interaccion
  ["primary-foreground", "primary", WCAG_AA_NORMAL, "text on primary button"],
  ["secondary-foreground", "secondary", WCAG_AA_NORMAL, "text on secondary button"],
  ["accent-foreground", "accent", WCAG_AA_NORMAL, "text on accent"],
  // Semanticos
  ["destructive-foreground", "destructive", WCAG_AA_NORMAL, "text on destructive"],
];

// Algunos proyectos no declaran success/warning/info fg explicitos; comprobamos solo si existen.
const OPTIONAL_PAIRS: ContrastPair[] = [
  ["success-foreground", "success", WCAG_AA_NORMAL, "text on success"],
  ["warning-foreground", "warning", WCAG_AA_NORMAL, "text on warning"],
  ["info-foreground", "info", WCAG_AA_NORMAL, "text on info"],
];

// WCAG 1.4.11 "Non-text Contrast" aplica a componentes de UI funcionales
// (focus ring, borde de un input que es parte del control). NO aplica a
// bordes decorativos como divisores de celdas o cards.
const GLYPH_PAIRS: ContrastPair[] = [
  ["ring", "background", WCAG_AA_LARGE_OR_GLYPH, "focus ring on page"],
  ["input", "background", WCAG_AA_LARGE_OR_GLYPH, "input field boundary on page"],
];

const EXPECTED_PRIMARY_HUE_MIN = 210;
const EXPECTED_PRIMARY_HUE_MAX = 240;

describe("contrast.audit — light mode (:root)", () => {
  const tokens = parseTokens().root;

  it.each(REQUIRED_PAIRS)(
    "%s on %s meets AA %s (%s)",
    (fg, bg, min, _role) => {
      const fgValue = tokens[fg];
      const bgValue = tokens[bg];
      expect(fgValue, `token --${fg} missing from :root`).toBeDefined();
      expect(bgValue, `token --${bg} missing from :root`).toBeDefined();
      const ratio = contrastRatio(fgValue, bgValue);
      expect(
        ratio,
        `contrast(--${fg} on --${bg}) = ${ratio.toFixed(2)} — below ${min} (${_role})`,
      ).toBeGreaterThanOrEqual(min);
    },
  );

  it.each(OPTIONAL_PAIRS)(
    "%s on %s meets AA %s when both tokens are defined (%s)",
    (fg, bg, min, _role) => {
      const fgValue = tokens[fg];
      const bgValue = tokens[bg];
      if (!fgValue || !bgValue) {
        // Token no definido: omitimos. Se considerara obligatorio cuando se anada al contrato.
        return;
      }
      const ratio = contrastRatio(fgValue, bgValue);
      expect(
        ratio,
        `contrast(--${fg} on --${bg}) = ${ratio.toFixed(2)} — below ${min} (${_role})`,
      ).toBeGreaterThanOrEqual(min);
    },
  );

  it.each(GLYPH_PAIRS)(
    "%s vs %s meets UI glyph %s (%s)",
    (fg, bg, min, _role) => {
      const fgValue = tokens[fg];
      const bgValue = tokens[bg];
      expect(fgValue).toBeDefined();
      expect(bgValue).toBeDefined();
      const ratio = contrastRatio(fgValue, bgValue);
      expect(
        ratio,
        `contrast(--${fg} vs --${bg}) = ${ratio.toFixed(2)} — below ${min} (${_role})`,
      ).toBeGreaterThanOrEqual(min);
    },
  );
});

describe("contrast.audit — dark mode (.dark)", () => {
  const tokens = parseTokens().dark;

  it.each(REQUIRED_PAIRS)(
    "%s on %s meets AA %s (dark, %s)",
    (fg, bg, min, _role) => {
      const fgValue = tokens[fg];
      const bgValue = tokens[bg];
      expect(fgValue, `token --${fg} missing from .dark`).toBeDefined();
      expect(bgValue, `token --${bg} missing from .dark`).toBeDefined();
      const ratio = contrastRatio(fgValue, bgValue);
      expect(
        ratio,
        `contrast(--${fg} on --${bg}, dark) = ${ratio.toFixed(2)} — below ${min}`,
      ).toBeGreaterThanOrEqual(min);
    },
  );
});

describe("contrast.audit — palette guardrails", () => {
  const light = parseTokens().root;
  const dark = parseTokens().dark;

  it("every COLOR token in :root has a dark variant", () => {
    // Solo los tokens cuyo valor es un color (oklch/hex/rgb) requieren
    // contraparte en .dark. Los tokens de tipografia, radio y fuente se
    // comparten entre modos y no necesitan variante .dark.
    const isColorValue = (v: string) => /^\s*(oklch|rgb|rgba|hsl|#)/i.test(v);
    const missing = Object.keys(light).filter(
      (k) => isColorValue(light[k]) && !(k in dark),
    );
    expect(
      missing,
      `color tokens missing dark variant: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("--primary hue is in the documented blue range (210-240) in both modes", () => {
    const lightHue = parseOklch(light.primary).H;
    const darkHue = parseOklch(dark.primary).H;
    expect(
      lightHue,
      `light --primary hue = ${lightHue} (must be in ${EXPECTED_PRIMARY_HUE_MIN}..${EXPECTED_PRIMARY_HUE_MAX})`,
    ).toBeGreaterThanOrEqual(EXPECTED_PRIMARY_HUE_MIN);
    expect(lightHue).toBeLessThanOrEqual(EXPECTED_PRIMARY_HUE_MAX);
    expect(
      darkHue,
      `dark --primary hue = ${darkHue} (must be in ${EXPECTED_PRIMARY_HUE_MIN}..${EXPECTED_PRIMARY_HUE_MAX})`,
    ).toBeGreaterThanOrEqual(EXPECTED_PRIMARY_HUE_MIN);
    expect(darkHue).toBeLessThanOrEqual(EXPECTED_PRIMARY_HUE_MAX);
  });
});
