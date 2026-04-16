import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  createUser: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn(),
}));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  users: { _: "users_table" },
  auditEvents: { _: "audit_events_table" },
}));

import { createUser } from "../service.js";
import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
};

function createMockTenantDb() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      { id: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", name: "Test", slug: "test", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(chainable)),
  };
  return chainable;
}

async function createValidToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: "admin-uuid-1",
      email: "admin@example.com",
      role: "admin",
      tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
      isFreelancer: false,
      mustChangePassword: false,
      iat: now,
      exp: now + 900,
      ...overrides,
    },
    JWT_SECRET,
  );
}

describe("POST /api/users", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mockDb = createMockTenantDb();
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const { authMiddleware, tenantMiddleware, requireRole } = await import(
      "../../auth/middleware.js"
    );
    const { usersRoutes } = await import("../routes.js");

    app = new Hono<HonoEnv>();
    app.route("/api/users", usersRoutes);
  });

  const validBody = {
    email: "new@example.com",
    password: "SecurePass123",
    firstName: "María",
    lastName: "García",
    role: "recruiter",
    isFreelancer: false,
  };

  it("returns 201 on successful creation", async () => {
    vi.mocked(createUser).mockResolvedValue({
      id: "new-user-uuid",
      email: "new@example.com",
      firstName: "María",
      lastName: "García",
      role: "recruiter",
      isFreelancer: false,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const token = await createValidToken();
    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validBody),
    }, TEST_ENV);

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.data.email).toBe("new@example.com");
    expect(body.data.mustChangePassword).toBe(true);
  });

  it("returns 409 when email already exists", async () => {
    vi.mocked(createUser).mockResolvedValue(null);

    const token = await createValidToken();
    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validBody),
    }, TEST_ENV);

    expect(res.status).toBe(409);
  });

  it("returns 422 on validation failure", async () => {
    const token = await createValidToken();
    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: "not-an-email" }),
    }, TEST_ENV);

    expect(res.status).toBe(422);
  });

  it("returns 403 for non-admin user", async () => {
    const token = await createValidToken({ role: "recruiter" });
    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validBody),
    }, TEST_ENV);

    expect(res.status).toBe(403);
  });

  it("returns 401 without auth token", async () => {
    const res = await app.request("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    }, TEST_ENV);

    expect(res.status).toBe(401);
  });
});
