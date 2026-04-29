// Integration test for the password-reset happy path. Ejercita el módulo
// completo contra Neon real, con el SuppressedEmailService (no Resend), y
// además valida la postura intencionada de no-RLS sobre `password_reset_tokens`
// (research.md Decision: Tables Without RLS). Si alguien activa RLS en esa
// tabla por error, esta prueba lo cazará.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { passwordResetTokens, refreshTokens, users } from "@bepro/db";
import { eq } from "drizzle-orm";
import app from "../../../index.js";
import {
  cleanupTenant,
  getAdminDb,
  getWorkerDb,
  integrationEnv,
  seedTenant,
  type SeededTenant,
} from "../../candidates/__tests__/_integration/harness.js";
import { hash } from "bcryptjs";

const KNOWN_PASSWORD = "OldPa55!word";

interface IntegrationEnv {
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  ENVIRONMENT: string;
  FILES: R2Bucket;
  APP_URL: string;
  PASSWORD_RESET_RATE: KVNamespace;
}

// In-memory KV stub so the Worker code can call `put/get` without a real
// Cloudflare binding. Mirrors the surface used by `service.ts`.
function createKvStub(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async get(key: string) {
      return store.get(key) ?? null;
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

function pwResetEnv(): IntegrationEnv {
  // The password-reset request endpoint is pre-authentication: it queries
  // `users` to resolve an email-to-user mapping with no JWT and therefore
  // no `SET LOCAL app.tenant_id`. Production currently runs the Worker as
  // `neondb_owner` (BYPASSRLS) — see `packages/db/CLAUDE.md` §"Roles", which
  // marks the rotation to `app_worker` as "future production rotation." When
  // that rotation lands, the same gap that affects `auth/login`'s pre-auth
  // user lookup will need to be fixed alongside it (likely a SECURITY DEFINER
  // function `lookup_user_by_email`). Until then, the integration test
  // mirrors today's production by using `DATABASE_URL` (admin/BYPASSRLS) for
  // the Worker binding. The `non-RLS posture` sub-test below still uses the
  // app_worker connection (`getWorkerDb()`) to pin the design intent on
  // `password_reset_tokens` itself.
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) {
    throw new Error("DATABASE_URL required for the password-reset integration suite.");
  }
  return {
    ...integrationEnv(),
    DATABASE_URL: adminUrl,
    APP_URL: "http://localhost:5173",
    PASSWORD_RESET_RATE: createKvStub(),
  };
}

function extractTokenFromConsoleLog(args: unknown[]): string | null {
  for (const arg of args) {
    if (typeof arg !== "string") continue;
    try {
      const parsed = JSON.parse(arg);
      if (parsed.event === "email.suppressed" && parsed.urlPreview) {
        const url = new URL(parsed.urlPreview);
        const tok = url.searchParams.get("token");
        if (tok) return tok;
      }
    } catch {
      // Not JSON — ignore.
    }
  }
  return null;
}

describe("Password-reset HTTP integration (US1 happy path + no-RLS posture)", () => {
  let seeded: SeededTenant;
  let userEmail: string;

  beforeAll(async () => {
    seeded = await seedTenant();
    // Replace the seeded admin's password hash with a known value so we can
    // assert that confirmToken actually rotates it.
    const adminDb = getAdminDb();
    const newHash = await hash(KNOWN_PASSWORD, 4);
    await adminDb
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, seeded.users.admin.id));
    userEmail = seeded.users.admin.email;
  });

  afterAll(async () => {
    if (seeded?.tenantId) await cleanupTenant(seeded.tenantId);
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("round-trip: request → suppression log → confirm → AuthResult + cookie", async () => {
    const env = pwResetEnv();
    const captured: unknown[][] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      captured.push(args);
    });

    // Step 1 — request a reset.
    const requestRes = await app.request(
      "/api/auth/password-reset/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      },
      env,
    );
    expect(requestRes.status).toBe(200);
    const requestBody = (await requestRes.json()) as { message: string };
    expect(requestBody.message).toContain("Si la cuenta existe");

    // Step 2 — extract the token from the suppressed-email log.
    const allLogs = captured.flat();
    const token = extractTokenFromConsoleLog(allLogs);
    expect(token).toBeTruthy();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    logSpy.mockRestore();

    // Step 3 — confirm with the token + a new password.
    const NEW_PASSWORD = "NewPa55!word";
    const confirmRes = await app.request(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: NEW_PASSWORD }),
      },
      env,
    );
    expect(confirmRes.status).toBe(200);

    const confirmBody = (await confirmRes.json()) as Record<string, unknown>;
    expect(confirmBody.accessToken).toBeDefined();
    expect((confirmBody.user as Record<string, unknown>).email).toBe(userEmail);
    expect((confirmBody.user as Record<string, unknown>).mustChangePassword).toBe(false);

    const setCookie = confirmRes.headers.get("set-cookie");
    expect(setCookie).toContain("refresh_token=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/api/auth");
  });

  it("non-RLS posture — app_worker reads password_reset_tokens without SET LOCAL", async () => {
    // Insert a row vía admin and then read it back via app_worker WITHOUT
    // calling withTenantScope. If RLS were ever enabled on the table, the
    // app_worker SELECT would return 0 rows and this test would fail.
    const adminDb = getAdminDb();
    const inserted = await adminDb
      .insert(passwordResetTokens)
      .values({
        userId: seeded.users.admin.id,
        tokenHash: "0".repeat(64),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      })
      .returning({ id: passwordResetTokens.id });

    const workerDb = getWorkerDb();
    const visible = await workerDb
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, inserted[0].id));

    expect(visible).toHaveLength(1);

    // Cleanup.
    await adminDb
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, inserted[0].id));
  });

  it("revokes all active refresh_tokens for the user on successful confirm", async () => {
    const env = pwResetEnv();
    const adminDb = getAdminDb();

    // Seed two pre-existing refresh tokens for the user.
    await adminDb.insert(refreshTokens).values([
      {
        userId: seeded.users.admin.id,
        tokenHash: "rt-hash-existing-1",
        family: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      {
        userId: seeded.users.admin.id,
        tokenHash: "rt-hash-existing-2",
        family: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ]);

    // Restore the known password so request/confirm round-trip works.
    const newHash = await hash(KNOWN_PASSWORD, 4);
    await adminDb
      .update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, seeded.users.admin.id));

    const captured: unknown[][] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      captured.push(args);
    });
    await app.request(
      "/api/auth/password-reset/request",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      },
      env,
    );
    const token = extractTokenFromConsoleLog(captured.flat());
    logSpy.mockRestore();
    expect(token).toBeTruthy();

    const confirmRes = await app.request(
      "/api/auth/password-reset/confirm",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: "AnotherPa55!word" }),
      },
      env,
    );
    expect(confirmRes.status).toBe(200);

    // Pre-existing refresh tokens must all be revoked.
    const tokens = await adminDb
      .select({ tokenHash: refreshTokens.tokenHash, isRevoked: refreshTokens.isRevoked })
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, seeded.users.admin.id));
    const preExisting = tokens.filter((t) =>
      t.tokenHash.startsWith("rt-hash-existing-"),
    );
    expect(preExisting).toHaveLength(2);
    for (const t of preExisting) {
      expect(t.isRevoked).toBe(true);
    }
  });
});
