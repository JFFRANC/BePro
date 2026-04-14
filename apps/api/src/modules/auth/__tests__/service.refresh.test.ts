import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock hono/jwt
vi.mock("hono/jwt", () => ({
  sign: vi.fn().mockResolvedValue("mock-new-jwt-token"),
}));

vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn().mockReturnValue("mock-new-refresh-token"),
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
});

import { refresh } from "../service.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";

function createMockToken(overrides = {}) {
  return {
    id: "token-uuid-1",
    userId: "user-uuid-1",
    tokenHash: "hashed-token",
    family: "family-uuid-1",
    isRevoked: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockUser(overrides = {}) {
  return {
    id: "user-uuid-1",
    tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
    email: "user@example.com",
    passwordHash: "hashed",
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
  token?: ReturnType<typeof createMockToken> | null;
  user?: ReturnType<typeof createMockUser> | null;
  familyTokens?: ReturnType<typeof createMockToken>[];
} = {}) {
  const {
    token = createMockToken(),
    user = createMockUser(),
    familyTokens = [],
  } = options;

  let selectCallCount = 0;
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Token lookup by hash
        return Promise.resolve(token ? [token] : []);
      }
      if (selectCallCount === 2) {
        // User lookup by id
        return Promise.resolve(user ? [user] : []);
      }
      // Family tokens lookup (for reuse detection)
      return Promise.resolve(familyTokens);
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "new-token-uuid" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (callback: (tx: typeof chainable) => Promise<unknown>) => {
      return callback(chainable);
    }),
  };

  return chainable as unknown;
}

describe("refresh service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns new tokens for valid refresh token", async () => {
    const db = createMockDb();

    const result = await refresh(db as never, "valid-token-hash", JWT_SECRET);

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBeDefined();
    expect(result!.refreshToken).toBeDefined();
    expect(result!.user.email).toBe("user@example.com");
  });

  it("returns null for expired token", async () => {
    const db = createMockDb({
      token: createMockToken({
        expiresAt: new Date(Date.now() - 1000),
      }),
    });

    const result = await refresh(db as never, "expired-token-hash", JWT_SECRET);

    expect(result).toBeNull();
  });

  it("returns null for revoked token", async () => {
    const db = createMockDb({
      token: createMockToken({ isRevoked: true }),
    });

    const result = await refresh(db as never, "revoked-token-hash", JWT_SECRET);

    expect(result).toBeNull();
  });

  it("returns null for non-existent token", async () => {
    const db = createMockDb({ token: null });

    const result = await refresh(db as never, "nonexistent-hash", JWT_SECRET);

    expect(result).toBeNull();
  });

  it("revokes entire family on reuse of rotated token", async () => {
    const revokedToken = createMockToken({ isRevoked: true });
    const familyTokens = [
      createMockToken({ id: "token-1" }),
      createMockToken({ id: "token-2" }),
    ];
    const db = createMockDb({ token: revokedToken, familyTokens });
    const mockDb = db as { update: ReturnType<typeof vi.fn> };

    const result = await refresh(db as never, "reused-token-hash", JWT_SECRET);

    expect(result).toBeNull();
    // Verify update was called to revoke family
    expect(mockDb.update).toHaveBeenCalled();
  });
});
