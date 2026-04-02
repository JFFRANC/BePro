import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { tenants } from "../src/schema/tenants.js";
import { users } from "../src/schema/users.js";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  console.log("Seeding database...");

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "BePro Reclutamiento",
      slug: "bepro",
    })
    .onConflictDoNothing()
    .returning();

  if (tenant) {
    console.log(`Created tenant: ${tenant.name} (${tenant.slug})`);

    const passwordHash = await hash("admin123", 12);

    const [admin] = await db
      .insert(users)
      .values({
        tenantId: tenant.id,
        email: "admin@bepro.mx",
        passwordHash,
        firstName: "Admin",
        lastName: "BePro",
        role: "admin",
      })
      .onConflictDoNothing()
      .returning();

    if (admin) {
      console.log(`Created admin user: ${admin.email}`);
    } else {
      console.log("Admin user already exists, skipped.");
    }
  } else {
    console.log("Tenant 'bepro' already exists, skipped.");
  }

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
