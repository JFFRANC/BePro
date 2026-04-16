import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";
import type { AuthResult } from "../types.js";

vi.mock("../service.js", () => ({
  login: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

import { refresh } from "../service.js";

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

function mockRefreshSuccess(): AuthResult {
  return {
    accessToken: "mock-new-access-token",
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
    refreshToken: "mock-new-refresh-uuid",
  };
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with valid refresh cookie", async () => {
    vi.mocked(refresh).mockResolvedValue(mockRefreshSuccess());
    const app = await createApp();

    const res = await app.request(
      "/api/auth/refresh",
      {
        method: "POST",
        headers: {
          Cookie: "refresh_token=valid-uuid",
          "X-Requested-With": "fetch",
        },
      },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.accessToken).toBe("mock-new-access-token");
    expect(body.user.email).toBe("user@example.com");
  });

  it("sets new refresh_token cookie on success (rotation)", async () => {
    vi.mocked(refresh).mockResolvedValue(mockRefreshSuccess());
    const app = await createApp();

    const res = await app.request(
      "/api/auth/refresh",
      {
        method: "POST",
        headers: {
          Cookie: "refresh_token=valid-uuid",
          "X-Requested-With": "fetch",
        },
      },
      TEST_ENV,
    );

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("refresh_token=");
    expect(setCookie).toContain("HttpOnly");
  });

  it("returns 401 with missing cookie", async () => {
    const app = await createApp();

    const res = await app.request(
      "/api/auth/refresh",
      {
        method: "POST",
        headers: {
          "X-Requested-With": "fetch",
        },
      },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Invalid or expired refresh token");
  });

  it("returns 403 with missing X-Requested-With header", async () => {
    const app = await createApp();

    const res = await app.request(
      "/api/auth/refresh",
      {
        method: "POST",
        headers: {
          Cookie: "refresh_token=valid-uuid",
        },
      },
      TEST_ENV,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Missing required header");
  });

  it("returns 401 when service returns null (expired/revoked)", async () => {
    vi.mocked(refresh).mockResolvedValue(null);
    const app = await createApp();

    const res = await app.request(
      "/api/auth/refresh",
      {
        method: "POST",
        headers: {
          Cookie: "refresh_token=expired-uuid",
          "X-Requested-With": "fetch",
        },
      },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Invalid or expired refresh token");
  });
});
