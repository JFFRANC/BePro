import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => {
  class ClientNotFoundError extends Error {
    constructor() {
      super("CLIENT_NOT_FOUND");
      this.name = "ClientNotFoundError";
    }
  }
  return {
    createUser: vi.fn(),
    ClientNotFoundError,
  };
});

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn(),
}));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  users: { _: "users_table" },
  clients: { _: "clients_table" },
  clientAssignments: { _: "client_assignments_table" },
  auditEvents: { _: "audit_events_table" },
}));

import { createUser, ClientNotFoundError } from "../service.js";
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

  const VALID_CLIENT_ID = "1c1c63d9-2b5a-4f7e-9d1a-2cd2af1fbb0e";

  // 010 — recruiter requires clientId at the validator layer (FR-002).
  const validBody = {
    email: "new@example.com",
    password: "SecurePass123",
    firstName: "María",
    lastName: "García",
    role: "recruiter",
    isFreelancer: false,
    clientId: VALID_CLIENT_ID,
  };

  const validAdminBody = {
    email: "boss@example.com",
    password: "SecurePass123",
    firstName: "Hector",
    lastName: "Franco",
    role: "admin",
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

  // 010 — Client assignment paths
  it("returns 400 'cliente inactivo o inexistente' when service throws ClientNotFoundError", async () => {
    vi.mocked(createUser).mockRejectedValue(new ClientNotFoundError());

    const token = await createValidToken();
    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validBody),
    }, TEST_ENV);

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBe("cliente inactivo o inexistente");
  });

  it("returns 422 when role is recruiter but clientId is missing (Zod refinement)", async () => {
    const token = await createValidToken();
    const { clientId, ...bodyWithoutClient } = validBody;
    void clientId;
    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bodyWithoutClient),
    }, TEST_ENV);

    expect(res.status).toBe(422);
  });

  it("returns 201 for admin without clientId (admin doesn't require client)", async () => {
    vi.mocked(createUser).mockResolvedValue({
      id: "new-admin-uuid",
      email: "boss@example.com",
      firstName: "Hector",
      lastName: "Franco",
      role: "admin",
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
      body: JSON.stringify(validAdminBody),
    }, TEST_ENV);

    expect(res.status).toBe(201);
  });

  it("returns 422 when clientId is malformed (not a uuid)", async () => {
    const token = await createValidToken();
    const res = await app.request("/api/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...validBody, clientId: "not-a-uuid" }),
    }, TEST_ENV);

    expect(res.status).toBe(422);
  });
});
