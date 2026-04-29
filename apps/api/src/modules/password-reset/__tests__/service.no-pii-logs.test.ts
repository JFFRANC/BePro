// T058a — FR-013 guard. Captures every console.log/warn/error during one
// happy-path round-trip and one miss-path call, then asserts that across
// **all** captured arguments:
//   (a) the email address never appears verbatim,
//   (b) the plaintext token never appears verbatim,
//   (c) the new password never appears verbatim.
//
// Exception (whitelisted): the SuppressedEmailService event
//   { event: "email.suppressed", to, subject, urlPreview }
// is allowed to mention the recipient (FR-018, dev-only).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
    for (let i = 0; i < arr.length; i++) arr[i] = (i * 31) & 0xff;
    return arr;
  },
  subtle: {
    digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
});

import { confirmToken, issueToken } from "../service.js";
import { SuppressedEmailService } from "../../../lib/email-service.js";

const ENV = {
  ENVIRONMENT: "test",
  DATABASE_URL: "postgresql://test/test",
  JWT_ACCESS_SECRET: "x".repeat(32),
  APP_URL: "http://localhost:5173",
  PASSWORD_RESET_RATE: {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
  },
} as never;

const ACTIVE_USER = {
  id: "u-1",
  tenantId: "t-1",
  email: "secret-email@example.com",
  firstName: "Juan",
  lastName: "Perez",
  role: "admin",
  isFreelancer: false,
  isActive: true,
  mustChangePassword: false,
};

const SECRET_PASSWORD = "my-secret-password-123!";
const SECRET_TOKEN = "b".repeat(43);

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
      stage = tableName(tbl) === "password_reset_tokens" ? "token" : "user";
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

describe("FR-013 — no PII in logs (T058a)", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let captured: string[];

  beforeEach(() => {
    captured = [];
    const collect = (...args: unknown[]) => {
      captured.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    logSpy = vi.spyOn(console, "log").mockImplementation(collect);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(collect);
    errorSpy = vi.spyOn(console, "error").mockImplementation(collect);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  function assertNoPii(joined: string, opts: { allowEmailSuppression: boolean }) {
    // The plaintext password and the plaintext token must NEVER appear, even
    // inside the whitelisted email.suppressed event.
    expect(joined).not.toContain(SECRET_PASSWORD);
    expect(joined).not.toContain(SECRET_TOKEN);

    if (!opts.allowEmailSuppression) {
      expect(joined).not.toContain(ACTIVE_USER.email);
      return;
    }

    // The email-suppression event is allowed to carry `to` (FR-018), so we
    // accept the recipient *only* when wrapped in `email.suppressed` payloads.
    // Any other line containing the email is a violation.
    for (const line of joined.split("\n")) {
      if (!line.includes(ACTIVE_USER.email)) continue;
      // Whitelist: a string that parses as JSON and has event === email.suppressed.
      let allowed = false;
      try {
        const parsed = JSON.parse(line.trim());
        if (parsed.event === "email.suppressed") allowed = true;
      } catch {
        // ignore parse errors
      }
      if (!allowed) {
        throw new Error(`PII leak: email appears outside email.suppressed: ${line}`);
      }
    }
  }

  it("happy path round-trip never logs the password or token (email may appear only in email.suppressed)", async () => {
    const tokenRow = {
      id: "tok-1",
      userId: ACTIVE_USER.id,
      tokenHash: "h",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
    };
    const requestDb = createDb({ userRow: ACTIVE_USER });
    const confirmDb = createDb({ tokenRow, userRow: ACTIVE_USER });
    const emailService = new SuppressedEmailService();

    await issueToken({
      db: requestDb as never,
      email: ACTIVE_USER.email,
      emailService,
      env: ENV,
    });
    await confirmToken({
      db: confirmDb as never,
      rawToken: SECRET_TOKEN,
      newPassword: SECRET_PASSWORD,
      env: ENV,
    });

    const joined = captured.join("\n");
    assertNoPii(joined, { allowEmailSuppression: true });
  });

  it("miss path never logs the email, password, or token (no email.suppressed event fires)", async () => {
    const db = createDb({ userRow: null });
    const emailService = new SuppressedEmailService();

    await issueToken({
      db: db as never,
      email: "nobody@example.com",
      emailService,
      env: ENV,
    });

    const joined = captured.join("\n");
    expect(joined).not.toContain("nobody@example.com");
    expect(joined).not.toContain(SECRET_PASSWORD);
    expect(joined).not.toContain(SECRET_TOKEN);
  });

  it("transport-failure log carries user_id only — never the email or any other PII", async () => {
    const db = createDb({ userRow: ACTIVE_USER });
    const emailService = {
      send: vi.fn().mockRejectedValue(new Error("resend_transport_error_500")),
    };

    await issueToken({
      db: db as never,
      email: ACTIVE_USER.email,
      emailService,
      env: ENV,
    });

    const transportLines = captured.filter((l) =>
      l.includes("email.transport_failure"),
    );
    expect(transportLines.length).toBeGreaterThan(0);
    for (const line of transportLines) {
      expect(line).not.toContain(ACTIVE_USER.email);
      expect(line).not.toContain(SECRET_PASSWORD);
      expect(line).not.toContain(SECRET_TOKEN);
      expect(line).toContain(ACTIVE_USER.id);
    }
  });
});
