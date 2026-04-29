// US6 — audit trail. Asserts that on the success branches of issueToken and
// confirmToken the service writes one row each to audit_events with the
// correct action / actor_id / tenant_id / target_*. The tests verify the
// values passed to `recordAuditEvent` (mocked) — the DB-level append-only
// behavior is covered by the existing audit-events tests on real Neon.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../lib/audit.js", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

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

import { recordAuditEvent } from "../../../lib/audit.js";
import {
  PASSWORD_RESET_COMPLETED,
  PASSWORD_RESET_REQUESTED,
  confirmToken,
  issueToken,
} from "../service.js";

const ENV = {
  ENVIRONMENT: "test",
  DATABASE_URL: "postgresql://test/test",
  JWT_ACCESS_SECRET: "x".repeat(32),
  APP_URL: "http://localhost:5173",
  PASSWORD_RESET_RATE: { put: vi.fn(), get: vi.fn() },
} as never;

function tableName(tbl: object): string {
  for (const sym of Object.getOwnPropertySymbols(tbl)) {
    if (sym.toString() === "Symbol(drizzle:Name)") {
      return (tbl as Record<symbol, string>)[sym];
    }
  }
  return "";
}

function createDb(opts: {
  tokenRow?: Record<string, unknown> | null;
  userRow?: Record<string, unknown> | null;
}) {
  let stage: "token" | "user" = "token";
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
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: (tx: typeof chain) => Promise<unknown>) => {
      return cb(chain);
    }),
  };
  return chain;
}

const ACTIVE_USER = {
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

describe("US6 — audit events on the success paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("T052 — successful request inserts a `password_reset_requested` row referencing the user", async () => {
    const db = createDb({ userRow: ACTIVE_USER });
    const emailService = { send: vi.fn() };

    await issueToken({
      db: db as never,
      email: ACTIVE_USER.email,
      emailService,
      env: ENV,
    });

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: PASSWORD_RESET_REQUESTED,
        actorId: ACTIVE_USER.id,
        tenantId: ACTIVE_USER.tenantId,
        targetType: "user",
        targetId: ACTIVE_USER.id,
      }),
    );
  });

  it("T053 — successful confirm inserts a `password_reset_completed` row referencing the user", async () => {
    const tokenRow = {
      id: "tok-1",
      userId: "u-1",
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    const db = createDb({ tokenRow, userRow: ACTIVE_USER });

    const result = await confirmToken({
      db: db as never,
      rawToken: "a".repeat(43),
      newPassword: "NewPa55!word",
      env: ENV,
    });
    expect(result.ok).toBe(true);

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: PASSWORD_RESET_COMPLETED,
        actorId: ACTIVE_USER.id,
        tenantId: ACTIVE_USER.tenantId,
        targetType: "user",
        targetId: ACTIVE_USER.id,
      }),
    );
  });

  it("T037 (cross-ref) — no audit row written for an unknown email", async () => {
    const db = createDb({ userRow: null });
    const emailService = { send: vi.fn() };

    await issueToken({
      db: db as never,
      email: "nobody@example.com",
      emailService,
      env: ENV,
    });

    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("T037 (cross-ref) — no audit row written for a deactivated user", async () => {
    const db = createDb({ userRow: { ...ACTIVE_USER, isActive: false } });
    const emailService = { send: vi.fn() };

    await issueToken({
      db: db as never,
      email: ACTIVE_USER.email,
      emailService,
      env: ENV,
    });

    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it("audit row is written even if email transport fails (FR-013 + N1)", async () => {
    const db = createDb({ userRow: ACTIVE_USER });
    const emailService = {
      send: vi.fn().mockRejectedValue(new Error("resend_transport_error_500")),
    };
    // Spy on console.warn — the service logs `email.transport_failure` with
    // user_id only (no PII).
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await issueToken({
      db: db as never,
      email: ACTIVE_USER.email,
      emailService,
      env: ENV,
    });

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: PASSWORD_RESET_REQUESTED }),
    );
    // The transport-failure log carries user_id only — never the email.
    const warnLogs = warnSpy.mock.calls.flat().map(String);
    const transportLog = warnLogs.find((l) =>
      l.includes("email.transport_failure"),
    );
    expect(transportLog).toBeDefined();
    expect(transportLog).not.toContain(ACTIVE_USER.email);
    warnSpy.mockRestore();
  });
});
