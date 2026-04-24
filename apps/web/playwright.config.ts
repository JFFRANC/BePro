import { defineConfig, devices } from "@playwright/test";

// Minimal Playwright config for BePro web E2E tests.
// - Single project: chromium.
// - baseURL apunta al dev server de Vite (proxy /api -> :8787).
// - webServer arranca `pnpm dev` y espera 120s a que el puerto responda.
// - Trace on first retry para poder depurar flakes sin sobrecostos en CI.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
