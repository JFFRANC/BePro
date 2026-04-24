import { test, expect } from "@playwright/test";

// SC-008 (007-candidates-module, Phase 10F / T129):
// Un reclutador debe poder encontrar un candidato específico entre 10 000
// mediante la búsqueda en menos de 3 segundos end-to-end.
//
// Prerequisitos (no son responsabilidad de este test):
//  - El API de dev (wrangler) corre en http://localhost:8787 con DATABASE_URL_WORKER.
//  - El tenant "perf-10k" está sembrado con 10 000 candidatos (T130:
//    `pnpm -F @bepro/db seed:candidates-10k`).
//  - Uno de esos candidatos tiene el apellido "ZZZ-UNIQUE-SENTINEL-42"
//    (sentinel determinístico).
//  - Existe un admin con las credenciales que fija el seeder (T130):
//      email: perf-admin@perf.bepro.test
//      password: perf-admin-password
//    (Si el seeder cambia, ajustar las constantes de abajo para que coincidan
//    con packages/db/scripts/seed-10k-candidates.ts.)

const PERF_TENANT_SLUG = "perf-10k";
const PERF_ADMIN_EMAIL = "perf-admin@perf.bepro.test";
const PERF_ADMIN_PASSWORD = "perf-admin-password";
const SENTINEL_FULL = "ZZZ-UNIQUE-SENTINEL-42";
const SENTINEL_QUERY = "ZZZ-UNIQUE-SENTINEL";
const BUDGET_MS = 3_000;

test.describe("SC-008: candidate search performance (10k dataset)", () => {
  test("finds ZZZ-UNIQUE-SENTINEL-42 among 10k in under 3 s (SC-008)", async ({
    page,
  }) => {
    // 1) Login por UI (no reescribimos el flujo de auth, lo consumimos).
    await page.goto("/login");

    // Los inputs del LoginForm usan estos ids: tenantSlug, email, password.
    await page.locator("#tenantSlug").fill(PERF_TENANT_SLUG);
    await page.locator("#email").fill(PERF_ADMIN_EMAIL);
    await page.locator("#password").fill(PERF_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /iniciar sesi/i }).click();

    // Tras login exitoso el guard redirige a "/" (DashboardPage).
    // Esperamos a que deje de estar en /login.
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 15_000,
    });

    // 2) Ir a la lista de candidatos.
    await page.goto("/candidates");

    // Esperamos a que el input de búsqueda esté montado antes de cronometrar.
    const searchInput = page.getByPlaceholder(/nombre, correo o tel/i);
    await searchInput.waitFor({ state: "visible" });

    // 3) Cronometrar: desde que se tipea hasta que aparece el sentinel.
    const t0 = Date.now();

    await searchInput.fill(SENTINEL_QUERY);

    // La fila de la tabla debe mostrar el apellido sentinela.
    // El debounce del input es 250ms; aún así el presupuesto total es 3s.
    await page.getByText(SENTINEL_FULL).first().waitFor({
      state: "visible",
      timeout: BUDGET_MS,
    });

    const elapsed = Date.now() - t0;

    // Log legible para CI/humanos.
    // eslint-disable-next-line no-console
    console.log(`[e2e.search] elapsed_ms=${elapsed}`);

    expect(
      elapsed,
      `Expected search-to-visible latency under ${BUDGET_MS}ms, got ${elapsed}ms`,
    ).toBeLessThan(BUDGET_MS);
  });
});
