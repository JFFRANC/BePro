import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
};

async function createTestApp() {
  const { authMiddleware } = await import("../middleware.js");
  const app = new Hono<HonoEnv>();
  app.use("/protected/*", authMiddleware);
  app.get("/protected/resource", (c) => {
    const user = c.get("user");
    return c.json({ user });
  });
  return app;
}

async function createValidToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: "user-uuid-1",
      email: "user@example.com",
      role: "admin",
      tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
      isFreelancer: false,
      iat: now,
      exp: now + 900,
      ...overrides,
    },
    JWT_SECRET,
  );
}

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects request with missing Authorization header", async () => {
    const app = await createTestApp();
    const res = await app.request("/protected/resource", {}, TEST_ENV);
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects request with malformed Bearer token", async () => {
    const app = await createTestApp();
    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: "Bearer invalid-token" } },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("rejects request with expired JWT", async () => {
    const expiredToken = await sign(
      {
        sub: "user-uuid-1",
        email: "user@example.com",
        role: "admin",
        tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
        isFreelancer: false,
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800,
      },
      JWT_SECRET,
    );

    const app = await createTestApp();
    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${expiredToken}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("rejects request with JWT signed by wrong secret", async () => {
    const tamperedToken = await sign(
      {
        sub: "user-uuid-1",
        email: "user@example.com",
        role: "admin",
        tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
        isFreelancer: false,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
      },
      "wrong-secret-key!!!",
    );

    const app = await createTestApp();
    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${tamperedToken}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  it("sets user context on valid JWT", async () => {
    const token = await createValidToken();
    const app = await createTestApp();

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.user.id).toBe("user-uuid-1");
    expect(body.user.email).toBe("user@example.com");
    expect(body.user.role).toBe("admin");
    expect(body.user.tenantId).toBe("d9eb10b9-d578-48d7-a70c-5525a9c9eb47");
  });
});
