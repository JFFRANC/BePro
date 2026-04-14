import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";
import type { AuthResult } from "../types.js";

// Mock the service module
vi.mock("../service.js", () => ({
  login: vi.fn(),
}));

// Mock db helper
vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

import { login } from "../service.js";

const TEST_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  JWT_ACCESS_SECRET: "test-secret-key-256-bits-long!!",
  ENVIRONMENT: "test",
};

async function createApp() {
  const { default: authRoutes } = await import("../routes.js");
  const app = new Hono<HonoEnv>();
  app.route("/api/auth", authRoutes);
  return app;
}

function mockLoginSuccess(): AuthResult {
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

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with valid credentials", async () => {
    vi.mocked(login).mockResolvedValue(mockLoginSuccess());
    const app = await createApp();

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "secret",
          tenantSlug: "test-tenant",
        }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.accessToken).toBe("mock-access-token");
    expect(body.user.email).toBe("user@example.com");
    expect(body.user.role).toBe("admin");
    expect(body.expiresAt).toBeDefined();
  });

  it("sets refresh_token httpOnly cookie on success", async () => {
    vi.mocked(login).mockResolvedValue(mockLoginSuccess());
    const app = await createApp();

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "secret",
          tenantSlug: "test-tenant",
        }),
      },
      TEST_ENV,
    );

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain("refresh_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/api/auth");
  });

  it("returns 401 with wrong password", async () => {
    vi.mocked(login).mockResolvedValue(null);
    const app = await createApp();

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "wrong-password",
          tenantSlug: "test-tenant",
        }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Invalid credentials");
  });

  it("returns 401 with non-existent email (identical to wrong password)", async () => {
    vi.mocked(login).mockResolvedValue(null);
    const app = await createApp();

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nobody@example.com",
          password: "any-password",
          tenantSlug: "test-tenant",
        }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Invalid credentials");
  });

  it("returns 422 with invalid request body", async () => {
    const app = await createApp();

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Validation failed");
  });
});
