import { eq, and } from "drizzle-orm";
import { sign } from "hono/jwt";
import { compare } from "bcryptjs";
import { tenants, users, refreshTokens } from "@bepro/db";
import type { Database } from "@bepro/db";
import type { AuthResult, LoginParams } from "./types.js";

export type AuditEventType =
  | "login_success"
  | "login_failure"
  | "token_refresh"
  | "logout";

export interface AuditEvent {
  type: AuditEventType;
  userId?: string;
  tenantId?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Stub: will be replaced by actual audit module integration
export function recordAuditEvent(_event: AuditEvent): void {
  // No-op until audit module is implemented
}

const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const BRUTE_FORCE_MAX_ATTEMPTS = 5;
const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DUMMY_HASH = "$2a$12$000000000000000000000uGEApfMlqzMdLRPnmsJMKuPfJtLHfyta";

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function login(
  db: Database,
  params: LoginParams,
  jwtSecret: string,
): Promise<AuthResult | { locked: true } | null> {
  // Step 1: Look up tenant by slug (no RLS on tenants table)
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, params.tenantSlug));

  if (!tenant || !tenant.isActive) {
    await compare(params.password, DUMMY_HASH);
    return null;
  }

  // Step 2: Look up user scoped to the resolved tenant
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, params.email)));

  if (!user) {
    await compare(params.password, DUMMY_HASH);
    return null;
  }

  // Step 3: Brute-force check — is account locked?
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await compare(params.password, DUMMY_HASH);
    recordAuditEvent({ type: "login_failure", userId: user.id, tenantId: user.tenantId, timestamp: new Date(), metadata: { reason: "account_locked" } });
    return { locked: true };
  }

  // Step 4: Verify password
  const passwordValid = await compare(params.password, user.passwordHash);
  if (!passwordValid || !user.isActive) {
    // Increment brute-force counter
    const now = new Date();
    const windowExpired =
      user.firstFailedAt &&
      now.getTime() - user.firstFailedAt.getTime() > BRUTE_FORCE_WINDOW_MS;

    if (windowExpired || !user.firstFailedAt) {
      // Start new window
      await db
        .update(users)
        .set({ failedLoginCount: 1, firstFailedAt: now, lockedUntil: null })
        .where(eq(users.id, user.id));
    } else {
      const newCount = user.failedLoginCount + 1;
      const lockout =
        newCount >= BRUTE_FORCE_MAX_ATTEMPTS
          ? new Date(now.getTime() + BRUTE_FORCE_WINDOW_MS)
          : null;
      await db
        .update(users)
        .set({
          failedLoginCount: newCount,
          lockedUntil: lockout,
        })
        .where(eq(users.id, user.id));
    }
    recordAuditEvent({ type: "login_failure", userId: user.id, tenantId: user.tenantId, timestamp: new Date(), metadata: { reason: "invalid_credentials" } });
    return null;
  }

  // Step 5: Successful login — reset brute-force counters
  if (user.failedLoginCount > 0 || user.firstFailedAt || user.lockedUntil) {
    await db
      .update(users)
      .set({ failedLoginCount: 0, firstFailedAt: null, lockedUntil: null })
      .where(eq(users.id, user.id));
  }

  // Step 6: Generate JWT access token
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TOKEN_EXPIRY_SECONDS;

  const accessToken = await sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      isFreelancer: user.isFreelancer,
      iat: now,
      exp,
    },
    jwtSecret,
  );

  // Step 5: Generate opaque refresh token
  const rawRefreshToken = crypto.randomUUID();
  const tokenHash = await hashToken(rawRefreshToken);
  const family = crypto.randomUUID();
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    family,
    expiresAt,
  });

  recordAuditEvent({ type: "login_success", userId: user.id, tenantId: user.tenantId, timestamp: new Date() });

  return {
    accessToken,
    expiresAt: new Date(exp * 1000).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as AuthResult["user"]["role"],
      tenantId: user.tenantId,
      isFreelancer: user.isFreelancer,
    },
    refreshToken: rawRefreshToken,
  };
}

export async function refresh(
  db: Database,
  rawToken: string,
  jwtSecret: string,
): Promise<AuthResult | null> {
  const tokenHash = await hashToken(rawToken);

  // Step 1: Look up refresh token by hash
  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  if (!token) {
    return null;
  }

  // Step 2: Check for reuse of a rotated token (theft detection)
  if (token.isRevoked) {
    // Revoke entire family
    await db
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(
        and(
          eq(refreshTokens.userId, token.userId),
          eq(refreshTokens.family, token.family),
        ),
      );
    return null;
  }

  // Step 3: Check expiry
  if (token.expiresAt < new Date()) {
    return null;
  }

  // Step 4: Look up user for fresh claims
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, token.userId));

  if (!user || !user.isActive) {
    return null;
  }

  // Step 5: Revoke old token
  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.id, token.id));

  // Step 6: Generate new access token with fresh user data
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TOKEN_EXPIRY_SECONDS;

  const accessToken = await sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      isFreelancer: user.isFreelancer,
      iat: now,
      exp,
    },
    jwtSecret,
  );

  // Step 7: Create new refresh token in the same family
  const newRawToken = crypto.randomUUID();
  const newTokenHash = await hashToken(newRawToken);
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newTokenHash,
    family: token.family,
    expiresAt,
  });

  recordAuditEvent({ type: "token_refresh", userId: user.id, tenantId: user.tenantId, timestamp: new Date() });

  return {
    accessToken,
    expiresAt: new Date(exp * 1000).toISOString(),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as AuthResult["user"]["role"],
      tenantId: user.tenantId,
      isFreelancer: user.isFreelancer,
    },
    refreshToken: newRawToken,
  };
}

export async function logout(
  db: Database,
  rawToken: string,
): Promise<boolean> {
  const tokenHash = await hashToken(rawToken);

  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash));

  if (!token || token.isRevoked) {
    return false;
  }

  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.id, token.id));

  recordAuditEvent({ type: "logout", userId: token.userId, timestamp: new Date() });

  return true;
}
