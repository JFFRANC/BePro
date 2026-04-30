// Resetea el password del admin del tenant `bepro` al valor de seed
// (`admin123`) y desactiva mustChangePassword. Usado para que el e2e tenga
// credenciales determinísticas:
//
//   pnpm --filter @bepro/db reset:admin
//   pnpm --filter @bepro/web test:e2e
//
// Si se quiere usar un password distinto:
//   E2E_ADMIN_PASSWORD='OtroPass1!' pnpm --filter @bepro/db reset:admin
//
// Sólo afecta filas donde email = admin@bepro.mx en el tenant slug=bepro.
// No toca otros admins / otros tenants.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { tenants } from "../src/schema/tenants.js";
import { users } from "../src/schema/users.js";

async function resetAdmin() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const tenantSlug = process.env.E2E_TENANT_SLUG ?? "bepro";
  const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "admin@bepro.mx";
  const newPassword = process.env.E2E_ADMIN_PASSWORD ?? "admin123";

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  const [tenant] = await db
    .select({ id: tenants.id, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug));

  if (!tenant) {
    console.error(`Tenant '${tenantSlug}' no existe. Corre pnpm db:seed primero.`);
    process.exit(1);
  }

  const passwordHash = await hash(newPassword, 12);

  const updated = await db
    .update(users)
    .set({
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      failedLoginCount: 0,
      lockedUntil: null,
    })
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, adminEmail)))
    .returning({ id: users.id, email: users.email });

  if (updated.length === 0) {
    console.error(
      `Admin '${adminEmail}' no existe en tenant '${tenantSlug}'. Corre pnpm db:seed primero.`,
    );
    process.exit(1);
  }

  console.log(
    `✅ Reset OK: ${adminEmail} (tenant=${tenantSlug}) → password='${newPassword}', mustChangePassword=false, lockout cleared.`,
  );
}

resetAdmin().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
