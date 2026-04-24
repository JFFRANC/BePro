// Vitest setup file para apps/web.
// Se ejecuta una vez antes de cada archivo de test.
// Feature 009-ui-visual-refresh: agrega mock determinista de matchMedia
// y extiende expect con los matchers de vitest-axe.

import { afterEach, beforeEach, expect } from "vitest";
import * as matchers from "vitest-axe/matchers";
import { installMatchMediaMock } from "./src/test-utils/matchMedia";

expect.extend(matchers);

// Tipos: aumentamos las interfaces de Vitest con los matchers de vitest-axe.
declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

let matchMediaHandle: ReturnType<typeof installMatchMediaMock> | null = null;

beforeEach(() => {
  matchMediaHandle = installMatchMediaMock();
  // Expone el handle para que los tests puedan mutar el estado vi
  // (window as unknown as { __matchMediaHandle: ... }).__matchMediaHandle
  (window as unknown as { __matchMediaHandle: typeof matchMediaHandle }).__matchMediaHandle = matchMediaHandle;
});

afterEach(() => {
  matchMediaHandle?.reset();
  matchMediaHandle = null;
  delete (window as unknown as { __matchMediaHandle?: unknown }).__matchMediaHandle;
});
