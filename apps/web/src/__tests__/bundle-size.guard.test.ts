import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

import baseline from "./__fixtures__/bundle-baseline.json";

// Guardrail de tamano de bundle (SC-005): el total gzipped NO puede crecer mas
// de un 5% respecto al baseline capturado antes de la refresh.
//
// Este test se salta silenciosamente si no existe `apps/web/dist/` (ej. en una
// maquina local que solo ejecuta Vitest). En CI se corre `pnpm build` antes.

const DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../dist",
);
const ASSETS_DIR = path.join(DIST_DIR, "assets");

function gzippedSize(filePath: string): number {
  const buf = readFileSync(filePath);
  return gzipSync(buf).length;
}

function measureBundleGzipped(): { totalBytes: number; perFile: Record<string, number> } {
  const perFile: Record<string, number> = {};
  let total = 0;
  // index.html vive en dist/
  const htmlPath = path.join(DIST_DIR, "index.html");
  if (existsSync(htmlPath)) {
    const size = gzippedSize(htmlPath);
    perFile["index.html"] = size;
    total += size;
  }
  // assets/*.{js,css}
  if (existsSync(ASSETS_DIR)) {
    for (const entry of readdirSync(ASSETS_DIR)) {
      const full = path.join(ASSETS_DIR, entry);
      if (!statSync(full).isFile()) continue;
      if (!/\.(js|css)$/i.test(entry)) continue;
      const size = gzippedSize(full);
      perFile[entry] = size;
      total += size;
    }
  }
  return { totalBytes: total, perFile };
}

describe("bundle-size.guard", () => {
  const distExists = existsSync(DIST_DIR);

  it.skipIf(!distExists)(
    "total gzipped bundle is within 1.05x of the baseline",
    () => {
      const measured = measureBundleGzipped();
      const max = baseline.maxAllowedGzippedBytes;
      const baselineTotal = baseline.totalGzippedBytes;
      const deltaPct = ((measured.totalBytes - baselineTotal) / baselineTotal) * 100;
      expect(
        measured.totalBytes,
        `total = ${measured.totalBytes} B, baseline = ${baselineTotal} B (${deltaPct.toFixed(2)}%), max = ${max} B`,
      ).toBeLessThanOrEqual(max);
    },
  );

  it.skipIf(!distExists)("baseline fixture has positive totals", () => {
    expect(baseline.totalGzippedBytes).toBeGreaterThan(0);
    expect(baseline.maxAllowedGzippedBytes).toBeGreaterThanOrEqual(
      baseline.totalGzippedBytes,
    );
  });

  // Este es un "pin" para que sea obvio cuando el test se salta por falta de dist/.
  it.runIf(!distExists)(
    "skipped because apps/web/dist is not built — run `pnpm -F @bepro/web build` before CI",
    () => {
      expect(distExists).toBe(false);
    },
  );
});
