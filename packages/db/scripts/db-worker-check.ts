// Diagnóstico: prueba que app_worker puede conectarse vía WebSocket y abrir
// una transacción con SET LOCAL. Si esto falla, el problema no está en los
// tests sino en los grants/CONNECT del rol.
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const url = process.env.DATABASE_URL_WORKER;
  if (!url) {
    console.error("DATABASE_URL_WORKER no está en el entorno.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  try {
    // Paso 1: query simple (no transacción) para verificar CONNECT + SELECT.
    const r1 = await pool.query("SELECT current_user, current_database(), version()");
    console.log("1) SELECT como app_worker:", r1.rows[0]);

    // Paso 2: transacción con SET LOCAL — ejercita el mismo patrón de los tests.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000'");
      const r2 = await client.query("SELECT current_setting('app.tenant_id', true) AS ctx");
      console.log("2) transacción + SET LOCAL:", r2.rows[0]);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("FAIL:", (err as Error).message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
