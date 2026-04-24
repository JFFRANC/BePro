import { neon } from "@neondatabase/serverless";

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Uso: tsx scripts/db-query.ts "SELECT 1"');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL no está definido en el entorno.");
    process.exit(1);
  }

  const neonSql = neon(databaseUrl);
  const rows = await neonSql.query(query);
  console.table(rows);
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
