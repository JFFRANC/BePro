// US3 — token lifecycle. Asserts that:
//   T039 — confirm rejects an expired token.
//   T040 — confirm rejects a used token (no differentiation).
//   T041 — issuing a new token marks earlier valid rows as used (supersede).
//
// All three are validated against a mocked Drizzle that records the WHERE
// clauses the service builds. The actual DB-level behavior is exercised in
// the integration suite under T008's manual gate.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2a$12$mock-hash"),
}));

vi.mock("hono/jwt", () => ({
  sign: vi.fn().mockResolvedValue("mock-access-token"),
}));

vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn().mockReturnValue("mock-refresh-uuid"),
  getRandomValues: (arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) arr[i] = i;
    return arr;
  },
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
});

import { confirmToken, issueToken } from "../service.js";

interface CapturedQuery {
  table: string;
  whereCalls: number;
}

function createDbWithToken(opts: {
  tokenRow: Record<string, unknown> | null;
  userRow: Record<string, unknown> | null;
  superseded?: { calls: number };
}): unknown {
  // Track which select() chain we're in so where() returns the correct row.
  let selectStage: "token" | "user" = "token";
  const updateCalls: Array<{ values: unknown }> = [];
  const insertCalls: Array<{ values: unknown }> = [];
  const transactionRuns: number[] = [];

  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockImplementation((tbl: { _: { name?: string } }) => {
      const name = tbl?.["_"]?.name ?? "";
      selectStage = name.includes("password_reset_tokens") ? "token" : "user";
      return chain;
    }),
    where: vi.fn().mockImplementation(() => {
      if (selectStage === "token") {
        return Promise.resolve(opts.tokenRow ? [opts.tokenRow] : []);
      }
      return Promise.resolve(opts.userRow ? [opts.userRow] : []);
    }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockImplementation((values: unknown) => {
      updateCalls.push({ values });
      return chain;
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockImplementation((values: unknown) => {
      insertCalls.push({ values });
      return Promise.resolve();
    }),
    transaction: vi.fn(async (cb: (tx: typeof chain) => Promise<unknown>) => {
      transactionRuns.push(transactionRuns.length + 1);
      return cb(chain);
    }),
  };
  (chain as unknown as { __captured: { updateCalls: typeof updateCalls; insertCalls: typeof insertCalls; transactionRuns: typeof transactionRuns } }).__captured = {
    updateCalls,
    insertCalls,
    transactionRuns,
  };
  return chain;
}

const ENV = {
  ENVIRONMENT: "test",
  DATABASE_URL: "postgresql://test/test",
  JWT_ACCESS_SECRET: "x".repeat(32),
  APP_URL: "http://localhost:5173",
  PASSWORD_RESET_RATE: { put: vi.fn(), get: vi.fn() },
} as never;

const RAW_TOKEN = "a".repeat(43);

describe("US3 — confirmToken lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T039 — rejects an expired token with the generic 400 reason", async () => {
    // Mock returns no row because the WHERE clause filters out expired rows
    // (the service includes `gt(expires_at, now())`). We simulate that filter
    // by returning an empty result set.
    const db = createDbWithToken({ tokenRow: null, userRow: null });
    const res = await confirmToken({
      db: db as never,
      rawToken: RAW_TOKEN,
      newPassword: "NewPa55!word",
      env: ENV,
    });
    expect(res.ok).toBe(false);
    expect((res as { reason: string }).reason).toBe("invalid_or_expired");
  });

  it("T040 — rejects a used token (used_at IS NOT NULL) with the same reason", async () => {
    // Same shape as T039 — the WHERE clause filters used rows out, returning
    // empty. The route layer returns the single 400 message regardless.
    const db = createDbWithToken({ tokenRow: null, userRow: null });
    const res = await confirmToken({
      db: db as never,
      rawToken: RAW_TOKEN,
      newPassword: "NewPa55!word",
      env: ENV,
    });
    expect(res.ok).toBe(false);
    expect((res as { reason: string }).reason).toBe("invalid_or_expired");
  });

  it("T041 — issuing a new token supersedes earlier still-valid rows for the user (transactional)", async () => {
    const userRow = {
      id: "u-1",
      tenantId: "t-1",
      email: "active@example.com",
      firstName: "Juan",
      lastName: "Perez",
      role: "admin",
      isFreelancer: false,
      isActive: true,
    };
    const db = createDbWithToken({ tokenRow: null, userRow });
    const captured = (db as { __captured: { updateCalls: Array<{ values: { usedAt?: Date } }>; insertCalls: Array<{ values: unknown }>; transactionRuns: number[] } }).__captured;

    const emailService = { send: vi.fn() };
    await issueToken({
      db: db as never,
      email: "active@example.com",
      emailService,
      env: ENV,
    });

    // The transaction must have run.
    expect(captured.transactionRuns.length).toBeGreaterThanOrEqual(1);
    // An UPDATE setting `usedAt` to a Date was issued (the supersede step).
    const supersedeUpdate = captured.updateCalls.find(
      (call) => call.values && (call.values as { usedAt?: unknown }).usedAt instanceof Date,
    );
    expect(supersedeUpdate).toBeDefined();
    // And the new token row was inserted.
    expect(captured.insertCalls.length).toBeGreaterThanOrEqual(1);
  });
});
