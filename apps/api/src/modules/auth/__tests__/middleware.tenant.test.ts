import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
};

function createMockTenant(overrides = {}) {
  return {
    id: "tenant-uuid-1",
    name: "Test Tenant",
    slug: "test-tenant",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockDb(tenant: ReturnType<typeof createMockTenant> | null = createMockTenant()) {
  const mockExecute = vi.fn().mockResolvedValue(undefined);
  const tx = {
    execute: mockExecute,
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(tenant ? [tenant] : []),
  };
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(tenant ? [tenant] : []),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback(tx);
    }),
    _tx: tx,
    _mockExecute: mockExecute,
  };
}

async function createToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: "user-uuid-1",
      email: "user@example.com",
      role: "admin",
      tenantId: "tenant-uuid-1",
      isFreelancer: false,
      iat: now,
      exp: now + 900,
      ...overrides,
    },
    JWT_SECRET,
  );
}

async function createTestApp() {
  const { authMiddleware, tenantMiddleware } = await import("../middleware.js");
  const app = new Hono<HonoEnv>();
  app.use("/protected/*", authMiddleware);
  app.use("/protected/*", tenantMiddleware);
  app.get("/protected/resource", (c) => {
    const db = c.get("db");
    return c.json({ tenantId: c.get("tenantId"), hasDb: !!db });
  });
  return app;
}

describe("tenantMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets tenantId on context for active tenant", async () => {
    vi.mocked(getDb).mockReturnValue(createMockDb() as never);
    const token = await createToken();
    const app = await createTestApp();

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.tenantId).toBe("tenant-uuid-1");
  });

  it("rejects request if tenant is inactive", async () => {
    vi.mocked(getDb).mockReturnValue(
      createMockDb(createMockTenant({ isActive: false })) as never,
    );
    const token = await createToken();
    const app = await createTestApp();

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Unauthorized");
  });

  it("rejects request if tenant not found", async () => {
    vi.mocked(getDb).mockReturnValue(createMockDb(null) as never);
    const token = await createToken();
    const app = await createTestApp();

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, any>;
    expect(body.error).toBe("Unauthorized");
  });

  it("calls SET LOCAL app.tenant_id via tx.execute()", async () => {
    const mockDb = createMockDb();
    vi.mocked(getDb).mockReturnValue(mockDb as never);
    const token = await createToken();
    const app = await createTestApp();

    await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    // Verify transaction was opened
    expect(mockDb.transaction).toHaveBeenCalled();
    // Verify SET LOCAL was called inside the transaction
    expect(mockDb._mockExecute).toHaveBeenCalled();
  });

  it("sets scoped db on context for downstream handlers", async () => {
    vi.mocked(getDb).mockReturnValue(createMockDb() as never);
    const token = await createToken();
    const app = await createTestApp();

    const res = await app.request(
      "/protected/resource",
      { headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.hasDb).toBe(true);
  });
});
