import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

async function applyRls() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const neonSql = neon(databaseUrl);
  const dir = dirname(fileURLToPath(import.meta.url));
  const rlsPath = resolve(dir, "../drizzle/0001_rls_policies.sql");
  const rlsSql = readFileSync(rlsPath, "utf8");

  // Split on semicolons, filter empty/comment-only lines
  const statements = rlsSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  for (const stmt of statements) {
    const preview = stmt.replace(/\n/g, " ").slice(0, 60);
    console.log(`Running: ${preview}...`);
    try {
      await neonSql.query(stmt);
    } catch (err) {
      const msg = (err as Error).message;
      // Skip "already exists" errors for idempotency
      if (msg.includes("already exists")) {
        console.log(`  Skipped (already exists)`);
      } else {
        throw err;
      }
    }
  }

  console.log("RLS policies applied successfully.");
}

applyRls().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
