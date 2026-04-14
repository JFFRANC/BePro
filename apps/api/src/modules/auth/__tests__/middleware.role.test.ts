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

async function createAppWithRole(...allowedRoles: string[]) {
  const { authMiddleware, requireRole } = await import("../middleware.js");
  const app = new Hono<HonoEnv>();
  app.use("/protected/*", authMiddleware);
  app.get(
    "/protected/resource",
    requireRole(...(allowedRoles as ["admin"])),
    (c) => c.json({ ok: true }),
  );
  return app;
}

async function createToken(role: string) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: "user-uuid-1",
      email: "user@example.com",
      role,
      tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
      isFreelancer: false,
      iat: now,
      exp: now + 900,
    },
    JWT_SECRET,
  );
}

describe("requireRole middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows request when user role is in permitted list", async () => {
    const token = await createToken("admin");
    const app = await createAppWithRole("admin", "manager");

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
  });

  it("returns 403 when role is not in permitted list", async () => {
    const token = await createToken("recruiter");
    const app = await createAppWithRole("admin", "manager");

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Forbidden");
  });

  it("works with a single permitted role", async () => {
    const token = await createToken("admin");
    const app = await createAppWithRole("admin");

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
  });

  it("rejects all non-matching roles with single permitted role", async () => {
    const token = await createToken("manager");
    const app = await createAppWithRole("admin");

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(403);
  });
});
