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

describe("brute-force on POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 when service returns locked", async () => {
    vi.mocked(login).mockResolvedValue({ locked: true } as never);
    const app = await createApp();

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "wrong",
          tenantSlug: "test",
        }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Too many attempts. Try again later.");
  });

  it("returns 401 normally on failed login (not locked)", async () => {
    vi.mocked(login).mockResolvedValue(null);
    const app = await createApp();

    const res = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "wrong",
          tenantSlug: "test",
        }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
  });
});
