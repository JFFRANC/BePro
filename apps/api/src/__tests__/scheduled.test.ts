// T058 — unit test for the cleanup cron handler. Verifies that
// `cleanupExpiredResetTokens` issues a DELETE against `password_reset_tokens`
// with the (used_at IS NOT NULL OR expires_at < now()) predicate.
//
// We assert the *shape* of the call rather than the actual DB outcome — the
// real-Neon round-trip is deferred to the integration suite under T008.

import { describe, it, expect, vi } from "vitest";

const deleteCalls: Array<{ table: string }> = [];
const whereCalls: Array<unknown> = [];

vi.mock("@bepro/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bepro/db")>();
  return {
    ...actual,
    createDb: () => ({
      delete: (tbl: object) => {
        // Read the Drizzle table name reflexively.
        let name = "";
        for (const sym of Object.getOwnPropertySymbols(tbl)) {
          if (sym.toString() === "Symbol(drizzle:Name)") {
            name = (tbl as Record<symbol, string>)[sym];
          }
        }
        deleteCalls.push({ table: name });
        return {
          where: (clause: unknown) => {
            whereCalls.push(clause);
            return Promise.resolve();
          },
        };
      },
    }),
  };
});

import { cleanupExpiredResetTokens } from "../scheduled.js";

const FAKE_ENV = {
  ENVIRONMENT: "test",
  DATABASE_URL: "postgresql://test/test",
  JWT_ACCESS_SECRET: "x".repeat(32),
  APP_URL: "http://localhost:5173",
  PASSWORD_RESET_RATE: { put: vi.fn(), get: vi.fn() },
} as never;

describe("cleanupExpiredResetTokens (T058)", () => {
  it("issues exactly one DELETE against password_reset_tokens", async () => {
    deleteCalls.length = 0;
    whereCalls.length = 0;
    await cleanupExpiredResetTokens(FAKE_ENV);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].table).toBe("password_reset_tokens");
    expect(whereCalls).toHaveLength(1);
  });
});
