// One-time helper: crea el rol `app_worker` en Neon con NOBYPASSRLS.
// Uso: `pnpm -F @bepro/db db:create-app-worker` (ver package.json).
//
// Toma la contraseña desde APP_WORKER_PASSWORD si está seteada, o la genera
// aleatoriamente. Imprime el connection string para que lo copies a .dev.vars
// como DATABASE_URL_WORKER. Nunca escribe secretos a disco.

import { neon } from "@neondatabase/serverless";
import { randomBytes } from "crypto";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL no está definido (admin connection string).");
    process.exit(1);
  }

  const password =
    process.env.APP_WORKER_PASSWORD ?? randomBytes(24).toString("base64url");

  const neonSql = neon(databaseUrl);

  const check = (await neonSql.query(
    "SELECT rolname FROM pg_roles WHERE rolname = 'app_worker'",
  )) as Array<{ rolname: string }>;

  if (check.length > 0) {
    console.log("El rol `app_worker` ya existe. Rotando contraseña…");
    await neonSql.query(`ALTER ROLE app_worker WITH LOGIN NOBYPASSRLS PASSWORD '${password.replace(/'/g, "''")}'`);
  } else {
    console.log("Creando rol `app_worker`…");
    await neonSql.query(
      `CREATE ROLE app_worker WITH LOGIN NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password.replace(/'/g, "''")}'`,
    );
  }

  const url = new URL(databaseUrl);
  const workerUrl = new URL(databaseUrl);
  workerUrl.username = "app_worker";
  workerUrl.password = password;

  console.log("\nRol listo. Ahora aplica los grants:");
  console.log("  pnpm -F @bepro/db db:exec drizzle/0008_app_worker_grants.sql\n");

  console.log("Y agrega esta variable a apps/api/.dev.vars (no la commitees):");
  console.log(`  DATABASE_URL_WORKER=${workerUrl.toString()}\n`);

  console.log(
    "El host/puerto/base de datos son los mismos que tu DATABASE_URL admin",
    `(${url.host}); sólo cambia el usuario a app_worker y la contraseña generada.\n`,
  );
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
