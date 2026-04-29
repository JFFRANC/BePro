// US5 — successful reset kills any attacker session AND clears lockout.
//
//   T049 — every active refresh_tokens row for the user is set to is_revoked=true.
//   T050 — users.failed_login_count, first_failed_at, locked_until are cleared
//          and must_change_password set to false; the next /auth/login should
//          succeed (deferred to integration smoke).
//
// Service-level mock test: we capture the UPDATE statements `confirmToken`
// builds inside its transaction and assert their shape. The full DB-level
// behavior (including the post-reset login) is exercised in the integration
// test under T008's manual gate.

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

import { confirmToken } from "../service.js";

const RAW_TOKEN = "a".repeat(43);

const ENV = {
  ENVIRONMENT: "test",
  DATABASE_URL: "postgresql://test/test",
  JWT_ACCESS_SECRET: "x".repeat(32),
  APP_URL: "http://localhost:5173",
  PASSWORD_RESET_RATE: { put: vi.fn(), get: vi.fn() },
} as never;

interface UpdateCapture {
  values: Record<string, unknown>;
}

// Drizzle stores the table name on `Symbol(drizzle:Name)`. We resolve it
// reflexively so the test stays decoupled from Drizzle internals.
function tableName(tbl: object): string {
  for (const sym of Object.getOwnPropertySymbols(tbl)) {
    if (sym.toString() === "Symbol(drizzle:Name)") {
      return (tbl as Record<symbol, string>)[sym];
    }
  }
  return "";
}

function createDb(opts: {
  tokenRow: Record<string, unknown> | null;
  userRow: Record<string, unknown> | null;
}) {
  let stage: "token" | "user" = "token";
  let lastUpdateTable = "";
  const updatesByTable = new Map<string, UpdateCapture[]>();
  const inserts: Array<{ values: unknown }> = [];

  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockImplementation((tbl: object) => {
      const name = tableName(tbl);
      stage = name === "password_reset_tokens" ? "token" : "user";
      return chain;
    }),
    where: vi.fn().mockImplementation(() => {
      if (stage === "token") {
        return Promise.resolve(opts.tokenRow ? [opts.tokenRow] : []);
      }
      return Promise.resolve(opts.userRow ? [opts.userRow] : []);
    }),
    update: vi.fn().mockImplementation((tbl: object) => {
      lastUpdateTable = tableName(tbl);
      return chain;
    }),
    set: vi.fn().mockImplementation((values: Record<string, unknown>) => {
      const list = updatesByTable.get(lastUpdateTable) ?? [];
      list.push({ values });
      updatesByTable.set(lastUpdateTable, list);
      return chain;
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockImplementation((values: unknown) => {
      inserts.push({ values });
      return Promise.resolve();
    }),
    transaction: vi.fn(async (cb: (tx: typeof chain) => Promise<unknown>) => {
      return cb(chain);
    }),
  };
  return { db: chain, updatesByTable, inserts };
}

describe("US5 — confirmToken kills sessions and clears lockout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T049 — issues an UPDATE on refresh_tokens setting is_revoked=true for the user", async () => {
    const tokenRow = {
      id: "tok-1",
      userId: "u-1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    const userRow = {
      id: "u-1",
      tenantId: "t-1",
      email: "active@example.com",
      firstName: "Juan",
      lastName: "Perez",
      role: "admin",
      isFreelancer: false,
      isActive: true,
      mustChangePassword: false,
    };
    const { db, updatesByTable } = createDb({ tokenRow, userRow });

    const result = await confirmToken({
      db: db as never,
      rawToken: RAW_TOKEN,
      newPassword: "NewPa55!word",
      env: ENV,
    });

    expect(result.ok).toBe(true);
    const refreshUpdates = updatesByTable.get("refresh_tokens") ?? [];
    expect(refreshUpdates.length).toBeGreaterThan(0);
    expect(
      refreshUpdates.some((u) => u.values.isRevoked === true),
    ).toBe(true);
  });

  it("T050 — clears failed_login_count, first_failed_at, locked_until and sets must_change_password=false", async () => {
    const tokenRow = {
      id: "tok-1",
      userId: "u-1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    const userRow = {
      id: "u-1",
      tenantId: "t-1",
      email: "locked@example.com",
      firstName: "Juan",
      lastName: "Perez",
      role: "admin",
      isFreelancer: false,
      isActive: true,
      mustChangePassword: true,
    };
    const { db, updatesByTable } = createDb({ tokenRow, userRow });

    const result = await confirmToken({
      db: db as never,
      rawToken: RAW_TOKEN,
      newPassword: "NewPa55!word",
      env: ENV,
    });

    expect(result.ok).toBe(true);
    const userUpdates = updatesByTable.get("users") ?? [];
    expect(userUpdates.length).toBe(1);
    const values = userUpdates[0].values;
    expect(values.failedLoginCount).toBe(0);
    expect(values.firstFailedAt).toBeNull();
    expect(values.lockedUntil).toBeNull();
    expect(values.mustChangePassword).toBe(false);
    expect(typeof values.passwordHash).toBe("string");
    expect((values.passwordHash as string).startsWith("$2a$")).toBe(true);
  });
});
