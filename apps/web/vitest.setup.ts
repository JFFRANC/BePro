// Vitest setup file para apps/web.
// Se ejecuta una vez antes de cada archivo de test.
// Feature 009-ui-visual-refresh: agrega mock determinista de matchMedia
// y extiende expect con los matchers de vitest-axe.
// Feature 010-user-client-assignment: agrega `cleanup()` global en afterEach
// para evitar leakage de portales (shadcn/base-ui Select, Dialog, Popover,
// DropdownMenu) entre tests del mismo archivo.

import { afterEach, beforeEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
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
  // Desmonta cualquier render dejado por @testing-library/react. Sin esto,
  // los portales (Select, Dialog, Popover, DropdownMenu) quedan en
  // document.body y contaminan getByRole/getByText del próximo test.
  cleanup();

  matchMediaHandle?.reset();
  matchMediaHandle = null;
  delete (window as unknown as { __matchMediaHandle?: unknown }).__matchMediaHandle;
});
