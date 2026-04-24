// Helper de test: parsea los bloques `:root { ... }` y `.dark { ... }` de
// apps/web/src/index.css y devuelve un mapa { [tokenName]: cssValue } por modo.
// Se usa por la auditoria de contraste y la auditoria de tipografia.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const INDEX_CSS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../index.css",
);

export type TokenMap = Record<string, string>;
export interface ParsedTokens {
  root: TokenMap;
  dark: TokenMap;
}

// Extrae el contenido del primer bloque que coincida con `selector { ... }`.
// Soporta anidamiento simple: cuenta llaves hasta balancear.
function extractBlock(css: string, selector: string): string | null {
  const startRe = new RegExp(`(^|\\n)\\s*${selector}\\s*\\{`);
  const match = css.match(startRe);
  if (!match || match.index === undefined) return null;

  const openIdx = css.indexOf("{", match.index);
  if (openIdx === -1) return null;

  let depth = 1;
  let i = openIdx + 1;
  while (i < css.length && depth > 0) {
    const ch = css[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  return css.slice(openIdx + 1, i - 1);
}

// Dado el contenido de un bloque CSS, extrae `--token: valor;` descartando
// reglas anidadas. `valor` conserva el texto original (incluido `oklch(...)`).
function extractTokens(blockContent: string): TokenMap {
  const tokens: TokenMap = {};
  // Eliminar bloques anidados (@media, selectores internos) antes de parsear.
  const topLevel = blockContent.replace(/\{[^{}]*\}/g, "");
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  const matches = topLevel.matchAll(re);
  for (const m of matches) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

export function parseTokensFromCss(css: string): ParsedTokens {
  const rootBlock = extractBlock(css, ":root");
  const darkBlock = extractBlock(css, "\\.dark");
  if (!rootBlock) {
    throw new Error("parseTokens: no se encontro el bloque :root en index.css");
  }
  if (!darkBlock) {
    throw new Error("parseTokens: no se encontro el bloque .dark en index.css");
  }
  return {
    root: extractTokens(rootBlock),
    dark: extractTokens(darkBlock),
  };
}

// Variante que lee directamente desde apps/web/src/index.css.
export function parseTokens(): ParsedTokens {
  const css = readFileSync(INDEX_CSS_PATH, "utf8");
  return parseTokensFromCss(css);
}
