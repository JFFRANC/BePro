import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Los tests de integración viven en *.integration.test.ts y se ejecutan
    // aparte vía `pnpm test:integration` porque requieren Neon real y
    // DATABASE_URL_WORKER. Aquí sólo corremos los tests unitarios/mockeados.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.integration.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
