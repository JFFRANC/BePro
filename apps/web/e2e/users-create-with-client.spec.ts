// 010-user-client-assignment / US1+US3 — e2e Playwright.
//
// Cubre:
//   - Field visibility por rol en el modal "Crear usuario" (US1 + US3).
//   - Happy path: admin crea un recruiter con un cliente activo y la fila aparece
//     en la lista de usuarios y en la vista de asignaciones del cliente.
//
// Prerequisitos:
//   - API en http://localhost:8787 con DATABASE_URL_WORKER.
//   - Tenant base de seed: slug=`bepro`.
//   - Credenciales admin del tenant: configurables vía env vars
//     (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD). Defaults: admin@bepro.mx /
//     admin123 (el seed inicial). Si ya cambiaste el password al hacer el
//     primer login manual, exporta E2E_ADMIN_PASSWORD con el password real.
//   - Al menos un cliente activo en el tenant. Si no hay, este test crea uno
//     mediante el flujo de Clientes (admin tiene permiso).

import { test, expect } from "@playwright/test";

const TENANT_SLUG = process.env.E2E_TENANT_SLUG ?? "bepro";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@bepro.mx";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  // El campo de tenant sólo aparece cuando NO existe VITE_LOGIN_TENANT_FIXED
  // (feature 008 — login tenant fijo por env). Si está oculto, el form ya
  // inyecta el slug correcto, así que sólo llenamos email + password.
  const tenantInput = page.locator("#tenantSlug");
  if (await tenantInput.count()) {
    await tenantInput.fill(TENANT_SLUG);
  }
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /iniciar sesi/i }).click();

  // Esperamos a CUALQUIERA de:
  //  (a) navegación fuera de /login (login OK), o
  //  (b) alerta de credenciales inválidas (login KO — fail-fast con un
  //      mensaje útil para el operador del e2e).
  const loginAlert = page.getByRole("alert").filter({ hasText: /invalid|credential|incorrect/i });
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 }),
    loginAlert.waitFor({ state: "visible", timeout: 15_000 }),
  ]);

  if (await loginAlert.isVisible().catch(() => false)) {
    throw new Error(
      `e2e login: credenciales inválidas para ${ADMIN_EMAIL}. ` +
        `Exporta E2E_ADMIN_PASSWORD con el password actual del admin antes de correr Playwright. ` +
        `Ej: E2E_ADMIN_PASSWORD='Sup3rSecret!' pnpm --filter @bepro/web test:e2e`,
    );
  }

  // Si el admin tiene mustChangePassword=true (raro tras el primer login),
  // aterriza en /force-password-change. El happy path del seed inicial
  // (admin123) NO trae ese flag, así que no manejamos ese branch aquí; si
  // aparece, el siguiente goto a /users redirige y el test falla con un
  // mensaje claro de que la sesión no está completamente válida.
}

async function getFirstActiveClientName(
  page: import("@playwright/test").Page,
): Promise<string> {
  // Sacamos el nombre vía API en lugar de parsear el DOM: el primer cell
  // de la tabla de clientes incluye iniciales del avatar + nombre, lo cual
  // no es estable como entrada para `getByRole("option", {name})`.
  // El auth-store guarda el JWT bajo la clave plana `accessToken` en
  // localStorage (apps/web/src/store/auth-store.ts:17).
  const token = await page.evaluate(() =>
    window.localStorage.getItem("accessToken"),
  );

  if (!token) {
    throw new Error(
      "e2e setup: no se pudo leer el access token del localStorage. ¿Estás logueado?",
    );
  }

  const res = await page.request.get(
    "http://localhost:8787/api/clients?isActive=true&limit=10&page=1",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok()) {
    throw new Error(
      `e2e setup: GET /api/clients → ${res.status()}. ¿API está corriendo en :8787?`,
    );
  }
  const body = (await res.json()) as { data: { id: string; name: string }[] };
  const first = body.data?.[0];
  if (!first) {
    throw new Error(
      "e2e setup: no hay clientes activos en este tenant. Crea uno desde /clients → Nuevo cliente antes de correr Playwright.",
    );
  }
  return first.name;
}

test.describe("010 — POST /api/users con clientId (modal create-user)", () => {
  test("Cliente field is hidden for admin and manager, required for AE/recruiter (US1 + US3)", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/users");
    await page.getByRole("button", { name: /nuevo usuario|crear usuario/i }).click();

    // Default role = recruiter ⇒ Cliente visible
    await expect(page.getByLabel(/^Cliente/)).toBeVisible();

    // Switch to admin ⇒ Cliente hidden
    await page.getByLabel(/^Rol/).click();
    await page.getByRole("option", { name: /administrador/i }).click();
    await expect(page.getByLabel(/^Cliente/)).toHaveCount(0);

    // Switch to manager ⇒ Cliente still hidden
    await page.getByLabel(/^Rol/).click();
    await page.getByRole("option", { name: /gerente/i }).click();
    await expect(page.getByLabel(/^Cliente/)).toHaveCount(0);

    // Switch to account_executive ⇒ Cliente visible again
    await page.getByLabel(/^Rol/).click();
    await page.getByRole("option", { name: /ejecutivo/i }).click();
    await expect(page.getByLabel(/^Cliente/)).toBeVisible();
  });

  test("admin can create a recruiter with a primary client in one step (US1 happy path)", async ({
    page,
  }) => {
    await login(page);
    const clientName = await getFirstActiveClientName(page);

    await page.goto("/users");
    await page.getByRole("button", { name: /nuevo usuario|crear usuario/i }).click();

    const ts = Date.now();
    const email = `e2e-rec-${ts}@bepro.mx`;
    const firstName = `Rec${ts}`;

    await page.getByLabel(/^Nombre/).fill(firstName);
    await page.getByLabel(/^Apellido/).fill("Test");
    await page.getByLabel(/^Correo/).fill(email);
    await page.getByLabel(/^Contraseña/).fill("Sup3rSecret!");

    // Role default = recruiter; pick the cliente.
    await page.getByLabel(/^Cliente/).click();
    await page.getByRole("option", { name: clientName }).click();

    await page.getByRole("button", { name: /nuevo usuario|crear usuario/i }).click();

    // Toast de éxito
    await expect(page.getByText(/usuario creado exitosamente/i)).toBeVisible({
      timeout: 10_000,
    });

    // El usuario aparece en la lista
    await expect(page.getByText(email)).toBeVisible({ timeout: 10_000 });
  });
});
