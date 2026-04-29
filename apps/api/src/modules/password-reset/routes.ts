import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import {
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
} from "@bepro/shared";
import type { HonoEnv } from "../../types.js";
import { zValidator } from "../../lib/validator.js";
import { getDb } from "../../lib/db.js";
import { getEmailService } from "../../lib/email-service.js";
import { checkAndIncrementEmailRate } from "../../lib/rate-limit-kv.js";
import { confirmToken, issueToken, runDummyWork } from "./service.js";

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

// Single Spanish copy used regardless of whether the email exists, the user
// is active, or the per-email rate-limit allowed the request (FR-001).
const REQUEST_OK_BODY = {
  message:
    "Si la cuenta existe, te hemos enviado un enlace para restablecer tu contraseña.",
} as const;

// Single Spanish copy returned for every confirm-failure variant (FR-014).
const CONFIRM_GENERIC_FAILURE = {
  error: "el enlace ha expirado, solicita uno nuevo",
} as const;

const passwordReset = new Hono<HonoEnv>();

passwordReset.post(
  "/request",
  zValidator("json", passwordResetRequestSchema),
  async (c) => {
    const { email } = c.req.valid("json");
    const db = getDb(c);
    const emailService = getEmailService(c.env);

    const allowed = await checkAndIncrementEmailRate(
      c.env.PASSWORD_RESET_RATE,
      email,
    );

    if (allowed) {
      await issueToken({ db, email, emailService, env: c.env });
    } else {
      // Rate-limited: skip token issuance + email dispatch, but still run the
      // enumeration-safe dummy work so timing remains indistinguishable from
      // an accepted call (FR-009).
      await runDummyWork(c.env);
    }

    // Always return the same body regardless of outcome (FR-001 / FR-009).
    return c.json(REQUEST_OK_BODY, 200);
  },
);

passwordReset.post(
  "/confirm",
  zValidator("json", passwordResetConfirmSchema),
  async (c) => {
    const { token, password } = c.req.valid("json");
    const db = getDb(c);

    const result = await confirmToken({
      db,
      rawToken: token,
      newPassword: password,
      env: c.env,
    });

    if (!result.ok) {
      return c.json(CONFIRM_GENERIC_FAILURE, 400);
    }

    setCookie(c, "refresh_token", result.auth.refreshToken, {
      path: "/api/auth",
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });

    return c.json(
      {
        accessToken: result.auth.accessToken,
        expiresAt: result.auth.expiresAt,
        user: result.auth.user,
      },
      200,
    );
  },
);

export default passwordReset;
