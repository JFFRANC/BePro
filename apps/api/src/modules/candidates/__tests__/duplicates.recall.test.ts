// 007-candidates-module — T128 / SC-009
// Validación de recall (>=95%) y precisión (FP <=5%) de normalizePhone
// contra un set etiquetado de pares telefónicos mexicanos.
import { describe, it, expect } from "vitest";
import { normalizePhone } from "../duplicates.js";
import fixture from "./fixtures/duplicates.json" with { type: "json" };

// Esquema de cada par en el fixture.
interface PhonePair {
  id: string;
  kind: "same" | "different";
  a: string;
  b: string;
  notes: string;
}

const pairs = fixture as PhonePair[];
const samePairs = pairs.filter((p) => p.kind === "same");
const differentPairs = pairs.filter((p) => p.kind === "different");

// Umbrales derivados del criterio SC-009 (>=95% recall, <=5% FP).
const MIN_RECALL = 0.95;
const MAX_FALSE_POSITIVE_RATE = 0.05;

describe("normalizePhone recall/precision (SC-009)", () => {
  it("loads a labelled fixture with >=150 same and >=50 different pairs", () => {
    expect(samePairs.length).toBeGreaterThanOrEqual(150);
    expect(differentPairs.length).toBeGreaterThanOrEqual(50);
    expect(pairs.length).toBeGreaterThanOrEqual(200);
  });

  it("achieves recall >=95% on same-number pairs (true positives / total)", () => {
    // Pares que deberían colapsar al mismo número normalizado pero no lo hicieron.
    const misses: Array<{ id: string; a: string; b: string; na: string; nb: string }> = [];
    let truePositives = 0;

    for (const pair of samePairs) {
      const na = normalizePhone(pair.a);
      const nb = normalizePhone(pair.b);
      if (na === nb && na !== "") {
        truePositives += 1;
      } else {
        misses.push({ id: pair.id, a: pair.a, b: pair.b, na, nb });
      }
    }

    const recall = truePositives / samePairs.length;

    if (misses.length > 0) {
      // Se loguea en CI para facilitar diagnóstico sin tener que re-ejecutar local.
      // eslint-disable-next-line no-console
      console.warn(
        `[duplicates.recall] ${misses.length} same-pair miss(es):\n` +
          misses
            .map((m) => `  - ${m.id}: "${m.a}" -> "${m.na}"  vs  "${m.b}" -> "${m.nb}"`)
            .join("\n"),
      );
    }

    expect(recall).toBeGreaterThanOrEqual(MIN_RECALL);
  });

  it("keeps false-positive rate <=5% on different-number pairs", () => {
    // Pares que colapsaron al mismo normalizado pese a ser números distintos.
    const falsePositives: Array<{ id: string; a: string; b: string; n: string }> = [];

    for (const pair of differentPairs) {
      const na = normalizePhone(pair.a);
      const nb = normalizePhone(pair.b);
      if (na === nb && na !== "") {
        falsePositives.push({ id: pair.id, a: pair.a, b: pair.b, n: na });
      }
    }

    const fpRate = falsePositives.length / differentPairs.length;

    if (falsePositives.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[duplicates.recall] ${falsePositives.length} false positive(s):\n` +
          falsePositives
            .map((f) => `  - ${f.id}: "${f.a}" and "${f.b}" both -> "${f.n}"`)
            .join("\n"),
      );
    }

    expect(fpRate).toBeLessThanOrEqual(MAX_FALSE_POSITIVE_RATE);
  });

  it("normalizes each same-pair correctly (per-pair assertion)", () => {
    // Aserción granular: si una regresión rompe un par específico, el mensaje
    // señalará exactamente cuál es. Se permite incumplir hasta el margen de recall.
    let failures = 0;
    const failureDetails: string[] = [];
    for (const pair of samePairs) {
      const na = normalizePhone(pair.a);
      const nb = normalizePhone(pair.b);
      if (na !== nb || na === "") {
        failures += 1;
        failureDetails.push(`${pair.id}: "${pair.a}"->"${na}" vs "${pair.b}"->"${nb}"`);
      }
    }
    // Permitimos hasta (1 - MIN_RECALL) de fallos; los pares no coincidentes
    // ya se registraron en el test de recall.
    const maxAllowed = Math.floor(samePairs.length * (1 - MIN_RECALL));
    expect(
      failures,
      `same-pair failures exceeded ${maxAllowed} tolerance:\n${failureDetails.join("\n")}`,
    ).toBeLessThanOrEqual(maxAllowed);
  });

  it("never collapses different-number pairs beyond the FP budget (per-pair)", () => {
    let collisions = 0;
    const collisionDetails: string[] = [];
    for (const pair of differentPairs) {
      const na = normalizePhone(pair.a);
      const nb = normalizePhone(pair.b);
      if (na !== "" && na === nb) {
        collisions += 1;
        collisionDetails.push(`${pair.id}: "${pair.a}" and "${pair.b}" both -> "${na}"`);
      }
    }
    const maxAllowed = Math.floor(differentPairs.length * MAX_FALSE_POSITIVE_RATE);
    expect(
      collisions,
      `different-pair collisions exceeded ${maxAllowed} tolerance:\n${collisionDetails.join("\n")}`,
    ).toBeLessThanOrEqual(maxAllowed);
  });
});

describe("normalizePhone metrics summary", () => {
  it("prints aggregate recall / precision for CI readers", () => {
    // Bloque puramente informativo — calcula métricas agregadas y las imprime.
    let tp = 0;
    for (const p of samePairs) {
      if (normalizePhone(p.a) === normalizePhone(p.b) && normalizePhone(p.a) !== "") tp += 1;
    }
    let fp = 0;
    for (const p of differentPairs) {
      if (normalizePhone(p.a) === normalizePhone(p.b) && normalizePhone(p.a) !== "") fp += 1;
    }
    const recall = tp / samePairs.length;
    const fpRate = fp / differentPairs.length;
    const precision = tp + fp === 0 ? 1 : tp / (tp + fp);

    // eslint-disable-next-line no-console
    console.log(
      `[duplicates.recall] fixture=${pairs.length} same=${samePairs.length} diff=${differentPairs.length} ` +
        `TP=${tp} FP=${fp} recall=${(recall * 100).toFixed(2)}% ` +
        `FPrate=${(fpRate * 100).toFixed(2)}% precision=${(precision * 100).toFixed(2)}%`,
    );

    expect(tp).toBeGreaterThan(0);
  });
});
