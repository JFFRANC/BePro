import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  issueToken: vi.fn().mockResolvedValue({ dispatched: true }),
  confirmToken: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/email-service.js", () => ({
  getEmailService: vi.fn().mockReturnValue({ send: vi.fn() }),
}));

const TEST_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  JWT_ACCESS_SECRET: "test-secret-key-256-bits-long!!",
  ENVIRONMENT: "test",
  APP_URL: "http://localhost:5173",
  PASSWORD_RESET_RATE: { put: vi.fn(), get: vi.fn() },
};

async function createApp() {
  const { default: passwordResetRoutes } = await import("../routes.js");
  const app = new Hono<HonoEnv>();
  app.route("/api/auth/password-reset", passwordResetRoutes);
  return app;
}

const EXPECTED_BODY = {
  message:
    "Si la cuenta existe, te hemos enviado un enlace para restablecer tu contraseña.",
};

describe("POST /api/auth/password-reset/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the generic Spanish message for a real email", async () => {
    const app = await createApp();
    const res = await app.request(
      "/api/auth/password-reset/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(EXPECTED_BODY);
  });

  it("returns 200 with the same body for an unknown email", async () => {
    const app = await createApp();
    const res = await app.request(
      "/api/auth/password-reset/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(EXPECTED_BODY);
  });

  it("returns 422 for malformed payloads", async () => {
    const app = await createApp();
    const res = await app.request(
      "/api/auth/password-reset/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});
