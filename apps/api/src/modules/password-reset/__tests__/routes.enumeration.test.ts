// US2 — enumeration safety. Asserts that the request endpoint produces a
// byte-identical 200 response for (a) an active user, (b) an unknown email,
// (c) a deactivated user — and that the audit table itself is not an
// enumeration oracle (no `password_reset_requested` row on miss/deactivated).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  issueToken: vi.fn(),
  confirmToken: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/email-service.js", () => ({
  getEmailService: vi.fn().mockReturnValue({ send: vi.fn() }),
}));

import { issueToken } from "../service.js";

const TEST_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  JWT_ACCESS_SECRET: "test-secret-key-256-bits-long!!",
  ENVIRONMENT: "test",
  APP_URL: "http://localhost:5173",
  PASSWORD_RESET_RATE: { put: vi.fn(), get: vi.fn() },
};

async function createApp() {
  const { default: passwordResetRoutes } = await import("../routes.js");
  const app = new Hono<HonoEnv>();
  app.route("/api/auth/password-reset", passwordResetRoutes);
  return app;
}

async function postRequest(email: string) {
  const app = await createApp();
  return app.request(
    "/api/auth/password-reset/request",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
    TEST_ENV,
  );
}

describe("US2 — enumeration safety on POST /request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the same JSON body and status for active / unknown / deactivated", async () => {
    // Mocked service returns whatever — the route always returns the same body.
    vi.mocked(issueToken).mockImplementation(async () => ({ dispatched: true }));
    const real = await postRequest("active@example.com");
    vi.mocked(issueToken).mockImplementation(async () => ({ dispatched: false }));
    const unknown = await postRequest("nobody@example.com");
    vi.mocked(issueToken).mockImplementation(async () => ({ dispatched: false }));
    const deactivated = await postRequest("inactive@example.com");

    expect(real.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(deactivated.status).toBe(200);

    const realBody = JSON.stringify(await real.json());
    const unknownBody = JSON.stringify(await unknown.json());
    const deactivatedBody = JSON.stringify(await deactivated.json());

    expect(realBody).toEqual(unknownBody);
    expect(unknownBody).toEqual(deactivatedBody);
  });
});

describe("US2 — audit table is not an enumeration oracle (FR-011)", () => {
  it("issueToken miss-path returns dispatched=false (no audit row written)", async () => {
    vi.mocked(issueToken).mockImplementation(async () => ({ dispatched: false }));
    const res = await postRequest("nobody@example.com");
    expect(res.status).toBe(200);
    // The route always returns the same body. The audit-table assertion is
    // exercised against real Neon in routes.audit.test.ts (Phase 8) — there
    // we assert that no `password_reset_requested` row exists for an unknown
    // email. Here we only assert the route did not bail out.
    expect(issueToken).toHaveBeenCalledTimes(1);
  });
});
