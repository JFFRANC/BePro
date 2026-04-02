import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { tenants } from "../packages/db/src/schema/tenants.js";
import { users } from "../packages/db/src/schema/users.js";

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
    .returning();

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
    .returning();

  console.log(`Created admin user: ${admin.email}`);
  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
