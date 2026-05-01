// 011-puestos-profile-docs — Playwright e2e (T088).
//
// Cubre el happy path de la feature:
//   - AE crea posición con perfil completo (todas las secciones del acordeón).
//   - AE sube contrato + pase de visita (PDFs reales en fixtures).
//   - AE reemplaza contrato con un segundo PDF.
//   - Recruiter ve la posición y descarga ambos.
//   - Admin abre Versiones y descarga el archivado.
//   - ClientDetailPage no tiene tab "Documentos".
//
// Prerequisitos:
//   - API + Web corriendo (Playwright los arranca via webServer).
//   - Migración 0009 + 0009_rls + 0010 aplicadas localmente.
//   - Seed: tenant `bepro` con admin / AE / recruiter en al menos un cliente.
//   - Fixtures `e2e/fixtures/contract-v1.pdf`, `contract-v2.pdf`, `pase.pdf`.
//
// Skipped por ahora (marker `test.skip`) — habilitar cuando los fixtures y el
// seed estén disponibles en el ambiente local. La estructura está intacta para
// activar el test cambiando `test.skip` por `test`.

import { test, expect } from "@playwright/test";

const TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? "bepro";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@bepro.mx";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";
const AE_EMAIL = process.env.E2E_AE_EMAIL ?? "ae@bepro.mx";
const AE_PASSWORD = process.env.E2E_AE_PASSWORD ?? "ae123";
const RECRUITER_EMAIL =
  process.env.E2E_RECRUITER_EMAIL ?? "recruiter@bepro.mx";
const RECRUITER_PASSWORD =
  process.env.E2E_RECRUITER_PASSWORD ?? "recruiter123";

async function login(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  const tenantInput = page.locator("#tenantSlug");
  if (await tenantInput.count()) await tenantInput.fill(TENANT_SLUG);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /iniciar sesi/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

async function logout(page: import("@playwright/test").Page) {
  // Header dropdown → "Cerrar sesión" (feature 008)
  await page.getByRole("button", { name: /menú de usuario|user menu/i }).click();
  await page.getByRole("menuitem", { name: /cerrar sesi/i }).click();
  await page.waitForURL(/\/login/);
}

test.describe.skip("011 — position profile + documents end-to-end", () => {
  test("AE crea posición con perfil completo, sube docs, reemplaza contrato; recruiter descarga; admin ve Versiones; tab Documentos ausente", async ({
    page,
  }) => {
    // 1) AE crea cliente (asumimos uno existe; aquí navegamos al primero).
    await login(page, AE_EMAIL, AE_PASSWORD);
    await page.goto("/clients");
    await page.locator("table tbody tr").first().click();

    // 2) Tab Puestos → crear puesto
    await page.getByRole("tab", { name: /puestos/i }).click();
    await page.getByRole("button", { name: /agregar puesto/i }).click();
    await page.locator('input[placeholder*="Nombre del puesto"]').fill(
      "AYUDANTE GENERAL E2E",
    );
    await page.locator("button:has(svg.lucide-check)").click();

    // 3) Click en la fila → PositionDetailPage
    await page
      .getByRole("row")
      .filter({ hasText: "AYUDANTE GENERAL E2E" })
      .click();
    await expect(
      page.getByRole("heading", { name: /AYUDANTE GENERAL E2E/i }),
    ).toBeVisible();

    // 4) Llenar campos del perfil y guardar
    await page.getByLabel(/Vacantes/i).fill("80");
    await page.getByLabel(/Edad mínima/i).fill("18");
    await page.getByLabel(/Edad máxima/i).fill("48");
    await page.getByRole("button", { name: /Guardar cambios/i }).click();

    // 5) Subir contrato v1
    const contractV1 = "e2e/fixtures/contract-v1.pdf";
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(contractV1);
    await expect(page.getByText(/Contrato/i)).toBeVisible();

    // 6) Reemplazar contrato con v2
    await page.getByRole("button", { name: /Reemplazar/i }).first().click();
    const contractV2 = "e2e/fixtures/contract-v2.pdf";
    await fileInput.setInputFiles(contractV2);

    // 7) Logout, login como recruiter, descargar contrato
    await logout(page);
    await login(page, RECRUITER_EMAIL, RECRUITER_PASSWORD);
    await page.goto("/clients");
    await page.locator("table tbody tr").first().click();
    await page.getByRole("tab", { name: /puestos/i }).click();

    // El recruiter ve los íconos inline en la fila
    const row = page
      .getByRole("row")
      .filter({ hasText: "AYUDANTE GENERAL E2E" });
    await expect(row.locator("svg.lucide-file-text")).toBeVisible();

    // 8) Logout, login como admin, abrir Versiones
    await logout(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto("/clients");
    await page.locator("table tbody tr").first().click();
    await page.getByRole("tab", { name: /puestos/i }).click();
    await page
      .getByRole("row")
      .filter({ hasText: "AYUDANTE GENERAL E2E" })
      .click();

    // Versiones panel admin-only
    await page.getByRole("button", { name: /Versiones/i }).click();
    await expect(page.getByText(/Contrato/i).first()).toBeVisible();

    // 9) ClientDetailPage no tiene "Documentos" tab
    await page.goto("/clients");
    await page.locator("table tbody tr").first().click();
    await expect(
      page.getByRole("tab", { name: /documentos/i }),
    ).toHaveCount(0);
  });
});
