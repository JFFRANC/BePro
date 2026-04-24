import { defineConfig } from "vitest/config";
import path from "path";

// Config dedicada para tests de integración contra Neon real.
// Se invoca con `pnpm test:integration` (ver package.json).
//
// Requisitos de entorno (leídos desde apps/api/.dev.vars o ya exportados):
//  - DATABASE_URL         — rol admin con BYPASSRLS, usado para fixture setup/teardown
//  - DATABASE_URL_WORKER  — rol app_worker (NOBYPASSRLS), usado para probar RLS de verdad
//
// pool: "forks" + singleFork evita explosion de conexiones HTTP hacia Neon y
// permite que los tests compartan el mismo runtime node sin contaminarse entre sí.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
