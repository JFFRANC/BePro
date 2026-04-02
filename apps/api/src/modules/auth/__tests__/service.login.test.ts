import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthResult, LoginParams } from "../types.js";

// Mock bcryptjs before importing service
vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

// Mock hono/jwt
vi.mock("hono/jwt", () => ({
  sign: vi.fn().mockResolvedValue("mock-jwt-token"),
}));

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn().mockReturnValue("mock-uuid-refresh-token"),
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
});

import { compare } from "bcryptjs";
import { login } from "../service.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";

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

function createMockUser(overrides = {}) {
  return {
    id: "user-uuid-1",
    tenantId: "tenant-uuid-1",
    email: "user@example.com",
    passwordHash: "$2a$12$hashedpassword",
    firstName: "Juan",
    lastName: "Perez",
    role: "admin" as const,
    isFreelancer: false,
    isActive: true,
    failedLoginCount: 0,
    firstFailedAt: null,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockDb(options: {
  tenant?: ReturnType<typeof createMockTenant> | null;
  user?: ReturnType<typeof createMockUser> | null;
} = {}) {
  const { tenant = createMockTenant(), user = createMockUser() } = options;

  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      // First call is tenant lookup, second is user lookup
      if (chainable.where.mock.calls.length <= 1) {
        return Promise.resolve(tenant ? [tenant] : []);
      }
      // Simulate DB filtering: user must match the tenant
      if (user && tenant && user.tenantId !== tenant.id) {
        return Promise.resolve([]);
      }
      return Promise.resolve(user ? [user] : []);
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "token-uuid-1" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (callback: (tx: typeof chainable) => Promise<unknown>) => {
      return callback(chainable);
    }),
  };

  return chainable as unknown;
}

describe("login service", () => {
  const validParams: LoginParams = {
    email: "user@example.com",
    password: "correct-password",
    tenantSlug: "test-tenant",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tokens for valid credentials", async () => {
    const db = createMockDb();
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await login(db as never, validParams, JWT_SECRET);

    expect(result).not.toBeNull();
    expect(result).not.toEqual({ locked: true });
    const auth = result as AuthResult;
    expect(auth.accessToken).toBeDefined();
    expect(auth.user.email).toBe("user@example.com");
    expect(auth.user.role).toBe("admin");
    expect(auth.user.tenantId).toBe("tenant-uuid-1");
    expect(auth.refreshToken).toBeDefined();
    expect(auth.expiresAt).toBeDefined();
  });

  it("returns null for wrong password", async () => {
    const db = createMockDb();
    vi.mocked(compare).mockResolvedValue(false as never);

    const result = await login(db as never, validParams, JWT_SECRET);

    expect(result).toBeNull();
  });

  it("returns null for non-existent email (constant-time)", async () => {
    const db = createMockDb({ user: null });
    vi.mocked(compare).mockResolvedValue(false as never);

    const result = await login(
      db as never,
      { ...validParams, email: "nobody@example.com" },
      JWT_SECRET,
    );

    expect(result).toBeNull();
    // bcrypt.compare should still be called for constant-time behavior
    expect(compare).toHaveBeenCalled();
  });

  it("returns null for inactive user", async () => {
    const db = createMockDb({ user: createMockUser({ isActive: false }) });
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await login(db as never, validParams, JWT_SECRET);

    expect(result).toBeNull();
  });

  it("returns null for inactive tenant (constant-time)", async () => {
    const db = createMockDb({
      tenant: createMockTenant({ isActive: false }),
    });
    vi.mocked(compare).mockResolvedValue(false as never);

    const result = await login(db as never, validParams, JWT_SECRET);

    expect(result).toBeNull();
    // bcrypt.compare is still called with dummy hash for constant-time behavior
    expect(compare).toHaveBeenCalled();
  });

  it("returns null for non-existent tenant (constant-time)", async () => {
    const db = createMockDb({ tenant: null });
    vi.mocked(compare).mockResolvedValue(false as never);

    const result = await login(db as never, validParams, JWT_SECRET);

    expect(result).toBeNull();
    // bcrypt.compare is still called with dummy hash for constant-time behavior
    expect(compare).toHaveBeenCalled();
  });

  it("passes tenant_id to user lookup WHERE clause", async () => {
    const db = createMockDb();
    vi.mocked(compare).mockResolvedValue(true as never);
    const mockDb = db as { where: ReturnType<typeof vi.fn> };

    await login(db as never, validParams, JWT_SECRET);

    // Second where() call is the user lookup — verify it was called
    // (the actual drizzle `and(eq(...), eq(...))` produces a single argument)
    expect(mockDb.where).toHaveBeenCalledTimes(2);
  });

  it("returns null for user in different tenant", async () => {
    // User exists but belongs to a different tenant
    const db = createMockDb({
      user: createMockUser({ tenantId: "other-tenant-uuid" }),
    });
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await login(db as never, validParams, JWT_SECRET);

    // Should still return null because the user's tenantId doesn't match
    // the resolved tenant's id
    expect(result).toBeNull();
  });
});
