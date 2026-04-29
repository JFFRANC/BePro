// Aumenta los matchers de Vitest con `toHaveNoViolations` proveniente de vitest-axe.
// El registro en runtime vive en apps/web/vitest.setup.ts.

import "vitest";

declare module "vitest" {
  interface Assertion<T = unknown> {
    toHaveNoViolations(): T;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
