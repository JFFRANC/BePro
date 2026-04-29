import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";
import type { AuthResult } from "../../auth/types.js";

vi.mock("../service.js", () => ({
  issueToken: vi.fn(),
  confirmToken: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/email-service.js", () => ({
  getEmailService: vi.fn().mockReturnValue({ send: vi.fn() }),
}));

import { confirmToken } from "../service.js";

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

function mockAuth(): AuthResult {
  return {
    accessToken: "mock-access-token",
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    user: {
      id: "user-uuid-1",
      email: "user@example.com",
      firstName: "Juan",
      lastName: "Perez",
      role: "admin",
      tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
      isFreelancer: false,
      mustChangePassword: false,
    },
    refreshToken: "mock-refresh-token-uuid",
  };
}

const VALID_TOKEN = "a".repeat(43);
const VALID_PASSWORD = "NewPa55!word";

describe("POST /api/auth/password-reset/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with the same shape as /auth/login on success", async () => {
    vi.mocked(confirmToken).mockResolvedValue({ ok: true, auth: mockAuth() });
    const app = await createApp();

    const res = await app.request(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: VALID_TOKEN,
          password: VALID_PASSWORD,
        }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessToken).toBe("mock-access-token");
    expect(body.expiresAt).toBeDefined();
    expect((body.user as Record<string, unknown>).email).toBe(
      "user@example.com",
    );
    expect((body.user as Record<string, unknown>).mustChangePassword).toBe(
      false,
    );
  });

  it("sets refresh_token httpOnly cookie identical to /auth/login", async () => {
    vi.mocked(confirmToken).mockResolvedValue({ ok: true, auth: mockAuth() });
    const app = await createApp();

    const res = await app.request(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: VALID_TOKEN,
          password: VALID_PASSWORD,
        }),
      },
      TEST_ENV,
    );

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("refresh_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/api/auth");
  });

  it("returns 400 with the generic Spanish message on any token failure", async () => {
    vi.mocked(confirmToken).mockResolvedValue({
      ok: false,
      reason: "invalid_or_expired",
    });
    const app = await createApp();

    const res = await app.request(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: VALID_TOKEN,
          password: VALID_PASSWORD,
        }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("el enlace ha expirado, solicita uno nuevo");
  });

  it("returns 422 when the token does not match the 43-char base64url pattern", async () => {
    const app = await createApp();
    const res = await app.request(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "short", password: VALID_PASSWORD }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when the password fails the FR-008 complexity rules", async () => {
    const app = await createApp();
    const res = await app.request(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: VALID_TOKEN,
          // Missing the non-alphanumeric character → fails FR-008.
          password: "Simple12345",
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});
