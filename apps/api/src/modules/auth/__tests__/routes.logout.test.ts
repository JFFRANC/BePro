import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

import { logout } from "../service.js";

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

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 on valid logout and clears cookie", async () => {
    vi.mocked(logout).mockResolvedValue(true);
    const app = await createApp();

    const res = await app.request(
      "/api/auth/logout",
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
    expect(body.success).toBe(true);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("refresh_token=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("returns 401 on missing cookie", async () => {
    const app = await createApp();

    const res = await app.request(
      "/api/auth/logout",
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

  it("returns 403 on missing X-Requested-With header", async () => {
    const app = await createApp();

    const res = await app.request(
      "/api/auth/logout",
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

  it("returns 401 when service returns false (invalid token)", async () => {
    vi.mocked(logout).mockResolvedValue(false);
    const app = await createApp();

    const res = await app.request(
      "/api/auth/logout",
      {
        method: "POST",
        headers: {
          Cookie: "refresh_token=invalid-uuid",
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
