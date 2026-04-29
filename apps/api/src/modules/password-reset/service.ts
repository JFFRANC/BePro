import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import {
  passwordResetTokens,
  refreshTokens,
  users,
} from "@bepro/db";
import type { Database } from "@bepro/db";
import { recordAuditEvent } from "../../lib/audit.js";
import { generateAccessToken } from "../auth/service.js";
import type { Bindings } from "../../types.js";
import type { EmailService } from "../../lib/email-service.js";
import { buildResetEmail } from "./email-template.js";
import type {
  AuthResult as AuthAuthResult,
} from "../auth/types.js";
import type {
  ConfirmTokenResult,
  IssueTokenResult,
} from "./types.js";

// Module-local audit-action constants (F8 — `lib/audit.ts` left untouched).
export const PASSWORD_RESET_REQUESTED = "password_reset_requested";
export const PASSWORD_RESET_COMPLETED = "password_reset_completed";

// Bcrypt cost — matches the rest of the platform (§VI).
const BCRYPT_COST = 12;

// 30-minute token TTL (FR-003).
export const TOKEN_TTL_MS = 30 * 60 * 1000;

// 7-day refresh-token expiry — mirrors auth/service.ts.
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

// Module-level dummy buffer reused on the enumeration-safe miss path
// (research.md Decision 7). 32 zero bytes — same shape as a real token hash
// input so `crypto.subtle.digest` does the same amount of work.
const DUMMY_BUF = new Uint8Array(32);

/**
 * Enumeration-safe no-op work that mirrors the dominant variable cost of
 * the success path (one SHA-256 + one KV write). Called on miss / inactive
 * user paths and on rate-limited paths so timing distributions overlap.
 */
export async function runDummyWork(env: Bindings): Promise<void> {
  await crypto.subtle.digest("SHA-256", DUMMY_BUF as BufferSource);
  await env.PASSWORD_RESET_RATE.put("pwreset:_noop", "1", {
    expirationTtl: 60,
  });
}

// URL-safe base64 (no padding) — converts a Uint8Array to the 43-char
// representation used in the reset link.
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const buf = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateResetToken(): { raw: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return { raw: bytesToBase64Url(bytes) };
}

export interface IssueTokenContext {
  db: Database;
  email: string;
  emailService: EmailService;
  env: Bindings;
}

export async function issueToken(
  ctx: IssueTokenContext,
): Promise<IssueTokenResult> {
  const { db, email, emailService, env } = ctx;

  // Step 1 — resolve the user (case-insensitive email lookup).
  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()));

  // Step 2 — miss / inactive: enumeration-safe no-op work then return
  // (research.md Decision 7).
  if (!user || !user.isActive) {
    await runDummyWork(env);
    return { dispatched: false };
  }

  // Step 3 — generate token + hash, supersede older pending tokens, insert.
  const { raw } = generateResetToken();
  // Hash the raw base64url string — confirmToken hashes the same string from
  // the URL, so both sides MUST agree on the input shape.
  const tokenHash = await sha256Hex(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.transaction(async (tx) => {
    // Supersede older still-valid tokens for the same user (FR-004).
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      );
    await tx.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    // Audit row (FR-011) — only on the success path so the table is not
    // an enumeration oracle.
    await recordAuditEvent(tx as unknown as Database, {
      tenantId: user.tenantId,
      actorId: user.id,
      action: PASSWORD_RESET_REQUESTED,
      targetType: "user",
      targetId: user.id,
    });
  });

  // Step 4 — dispatch email. The audit row is independent of email success
  // (N1 — FR-011 + FR-013 + edge case E-04). We swallow transport errors and
  // log a no-PII structured event.
  const resetUrl = `${env.APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(raw)}`;
  const message = buildResetEmail({
    recipientName: user.firstName,
    resetUrl,
  });
  try {
    await emailService.send({
      to: user.email,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  } catch {
    console.warn(
      JSON.stringify({ event: "email.transport_failure", user_id: user.id }),
    );
  }

  return { dispatched: true };
}

export interface ConfirmTokenContext {
  db: Database;
  rawToken: string;
  newPassword: string;
  env: Bindings;
}

export async function confirmToken(
  ctx: ConfirmTokenContext,
): Promise<ConfirmTokenResult> {
  const { db, rawToken, newPassword, env } = ctx;

  // Step 1 — look up by hash. The lookup is index-only; comparison is done
  // by Postgres on the index, not in JS, so no application-level constant-
  // time compare is needed (FR-005, research.md Decision 2). Do not wrap
  // this in `crypto.timingSafeEqual` — that would re-introduce the JS-side
  // timing surface this design avoids.
  const tokenHash = await sha256Hex(rawToken);
  const [token] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    );

  if (!token) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  // Step 2 — resolve the user; deactivated → same generic failure.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, token.userId));

  if (!user || !user.isActive) {
    return { ok: false, reason: "invalid_or_expired" };
  }

  // Step 3 — hash the new password (cost ≥ 12) outside the transaction.
  const newHash = await hash(newPassword, BCRYPT_COST);

  // Step 4 — atomic update: password + lockout-clear + revoke refresh tokens
  // + mark token used + audit row.
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        passwordHash: newHash,
        failedLoginCount: 0,
        firstFailedAt: null,
        lockedUntil: null,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // FR-016 + research.md Decision 8 — kill all active sessions.
    await tx
      .update(refreshTokens)
      .set({ isRevoked: true })
      .where(
        and(
          eq(refreshTokens.userId, user.id),
          eq(refreshTokens.isRevoked, false),
        ),
      );

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, token.id));

    await recordAuditEvent(tx as unknown as Database, {
      tenantId: user.tenantId,
      actorId: user.id,
      action: PASSWORD_RESET_COMPLETED,
      targetType: "user",
      targetId: user.id,
    });
  });

  // Step 5 — issue a new session (access + refresh).
  const { accessToken, expiresAt: accessExpiresAt } =
    await generateAccessToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        isFreelancer: user.isFreelancer,
        mustChangePassword: false,
      },
      env.JWT_ACCESS_SECRET,
    );

  const newRefreshToken = crypto.randomUUID();
  const refreshTokenHash = await sha256Hex(newRefreshToken);
  const family = crypto.randomUUID();
  const refreshExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: refreshTokenHash,
    family,
    expiresAt: refreshExpiresAt,
  });

  const auth: AuthAuthResult = {
    accessToken,
    expiresAt: accessExpiresAt,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as AuthAuthResult["user"]["role"],
      tenantId: user.tenantId,
      isFreelancer: user.isFreelancer,
      mustChangePassword: false,
    },
    refreshToken: newRefreshToken,
  };

  return { ok: true, auth };
}
