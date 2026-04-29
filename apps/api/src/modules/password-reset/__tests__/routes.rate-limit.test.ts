// US4 — rate-limit at the request route. Asserts that:
//   T046 — 6 sequential POSTs for the same email all return 200 but issueToken
//          is only invoked 5 times (the 6th is throttled).
//
// Uses Vitest fake timers to advance past the 60 s minute-window between calls
// so we pressure the hourly budget specifically.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  issueToken: vi.fn().mockResolvedValue({ dispatched: true }),
  confirmToken: vi.fn(),
  runDummyWork: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock("../../../lib/email-service.js", () => ({
  getEmailService: vi.fn().mockReturnValue({ send: vi.fn() }),
}));

import { issueToken, runDummyWork } from "../service.js";

interface KVEntry {
  value: string;
  expiresAt: number;
}

function createKvStub(now: () => number): KVNamespace {
  const store = new Map<string, KVEntry>();
  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry || entry.expiresAt <= now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const ttl = opts?.expirationTtl ?? 0;
      store.set(key, { value, expiresAt: now() + ttl * 1000 });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: [], list_complete: true } as unknown as KVNamespaceListResult<unknown>;
    },
    async getWithMetadata() {
      return { value: null, metadata: null };
    },
  } as unknown as KVNamespace;
}

async function createApp() {
  const { default: passwordResetRoutes } = await import("../routes.js");
  const app = new Hono<HonoEnv>();
  app.route("/api/auth/password-reset", passwordResetRoutes);
  return app;
}

describe("US4 — rate-limit on POST /request (FR-009)", () => {
  let mockNow: number;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNow = 1_000_000;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("6 sequential calls return 200 but only 5 reach issueToken", async () => {
    const env = {
      DATABASE_URL: "postgresql://test/test",
      JWT_ACCESS_SECRET: "x".repeat(32),
      ENVIRONMENT: "test",
      APP_URL: "http://localhost:5173",
      PASSWORD_RESET_RATE: createKvStub(() => mockNow),
    };
    const app = await createApp();
    const email = "juan@ejemplo.com";
    let acceptedReturns = 0;

    for (let i = 0; i < 6; i++) {
      const res = await app.request(
        "/api/auth/password-reset/request",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { message: string };
      expect(body.message).toContain("Si la cuenta existe");
      acceptedReturns++;
      // Advance past the per-minute window so each call is bound only by
      // the per-hour budget (pressure point for this test).
      mockNow += 61_000;
    }

    expect(acceptedReturns).toBe(6);
    // 5 accepted issuances; the 6th was throttled and called runDummyWork.
    expect(vi.mocked(issueToken)).toHaveBeenCalledTimes(5);
    expect(vi.mocked(runDummyWork)).toHaveBeenCalledTimes(1);
  });

  it("two calls within 60 s for the same email throttle the second one", async () => {
    const env = {
      DATABASE_URL: "postgresql://test/test",
      JWT_ACCESS_SECRET: "x".repeat(32),
      ENVIRONMENT: "test",
      APP_URL: "http://localhost:5173",
      PASSWORD_RESET_RATE: createKvStub(() => mockNow),
    };
    const app = await createApp();
    const email = "juan@ejemplo.com";

    for (let i = 0; i < 2; i++) {
      const res = await app.request(
        "/api/auth/password-reset/request",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        env,
      );
      expect(res.status).toBe(200);
    }

    expect(vi.mocked(issueToken)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runDummyWork)).toHaveBeenCalledTimes(1);
  });
});
