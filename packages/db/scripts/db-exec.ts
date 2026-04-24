import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve } from "path";

// Divide SQL en sentencias respetando comentarios, literales y dollar-quoting ($tag$...$tag$).
function splitSql(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") {
        current += sql[i];
        i++;
      }
      continue;
    }

    if (ch === "/" && next === "*") {
      current += ch + next;
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) {
        current += sql[i];
        i++;
      }
      if (i < n) {
        current += sql[i] + sql[i + 1];
        i += 2;
      }
      continue;
    }

    if (ch === "'") {
      current += ch;
      i++;
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''";
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          current += "'";
          i++;
          break;
        }
        current += sql[i];
        i++;
      }
      continue;
    }

    if (ch === "$") {
      const tagMatch = sql.slice(i).match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)?\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        current += tag;
        i += tag.length;
        const closeIdx = sql.indexOf(tag, i);
        if (closeIdx === -1) {
          current += sql.slice(i);
          i = n;
        } else {
          current += sql.slice(i, closeIdx + tag.length);
          i = closeIdx + tag.length;
        }
        continue;
      }
    }

    if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Uso: tsx scripts/db-exec.ts <ruta/al/archivo.sql>");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL no está definido en el entorno.");
    process.exit(1);
  }

  const resolved = resolve(process.cwd(), filePath);
  const sql = readFileSync(resolved, "utf8");
  const statements = splitSql(sql);

  console.log(`→ ${filePath}`);
  console.log(`  ${statements.length} sentencia(s) detectada(s)`);

  const neonSql = neon(databaseUrl);

  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx];
    const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
    process.stdout.write(`  [${idx + 1}/${statements.length}] ${preview}… `);
    try {
      await neonSql.query(stmt);
      process.stdout.write("OK\n");
    } catch (err) {
      process.stdout.write("FAIL\n");
      console.error("\n--- Sentencia fallida ---");
      console.error(stmt);
      console.error("--- Error ---");
      console.error((err as Error).message);
      process.exit(1);
    }
  }

  console.log(`✓ ${filePath} aplicado correctamente.`);
}

main().catch((err) => {
  console.error("Fallo inesperado:", err);
  process.exit(1);
});
