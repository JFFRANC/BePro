import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("hono/jwt", () => ({
  sign: vi.fn().mockResolvedValue("mock-jwt-token"),
}));

vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn().mockReturnValue("mock-uuid"),
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
});

import { compare } from "bcryptjs";
import { login } from "../service.js";
import type { LoginParams } from "../types.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";

function createMockTenant() {
  return {
    id: "tenant-uuid-1",
    name: "Test",
    slug: "test",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockUser(overrides = {}) {
  return {
    id: "user-uuid-1",
    tenantId: "tenant-uuid-1",
    email: "user@example.com",
    passwordHash: "$2a$12$hash",
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
      if (chainable.where.mock.calls.length <= 1) {
        return Promise.resolve(tenant ? [tenant] : []);
      }
      return Promise.resolve(user ? [user] : []);
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "t-1" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: (tx: typeof chainable) => Promise<unknown>) => cb(chainable)),
  };
  return chainable as unknown;
}

const params: LoginParams = {
  email: "user@example.com",
  password: "password",
  tenantSlug: "test",
};

describe("brute-force protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 'locked' when account is locked", async () => {
    const db = createMockDb({
      user: createMockUser({
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
        failedLoginCount: 5,
      }),
    });
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await login(db as never, params, JWT_SECRET);

    expect(result).toEqual({ locked: true });
  });

  it("allows login when lockout has expired", async () => {
    const db = createMockDb({
      user: createMockUser({
        lockedUntil: new Date(Date.now() - 1000),
        failedLoginCount: 5,
        firstFailedAt: new Date(Date.now() - 20 * 60 * 1000),
      }),
    });
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await login(db as never, params, JWT_SECRET);

    expect(result).not.toBeNull();
    expect(result).not.toEqual({ locked: true });
    expect((result as { accessToken: string }).accessToken).toBeDefined();
  });

  it("resets counter on successful login", async () => {
    const db = createMockDb({
      user: createMockUser({
        failedLoginCount: 3,
        firstFailedAt: new Date(),
      }),
    });
    vi.mocked(compare).mockResolvedValue(true as never);
    const mockDb = db as { update: ReturnType<typeof vi.fn> };

    await login(db as never, params, JWT_SECRET);

    // update should be called to reset counters
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("increments counter on failed login", async () => {
    const db = createMockDb();
    vi.mocked(compare).mockResolvedValue(false as never);
    const mockDb = db as { update: ReturnType<typeof vi.fn> };

    await login(db as never, params, JWT_SECRET);

    expect(mockDb.update).toHaveBeenCalled();
  });
});
