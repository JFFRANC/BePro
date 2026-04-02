import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { loginSchema } from "@bepro/shared";
import { tenants } from "@bepro/db";
import type { HonoEnv } from "../../types.js";
import { zValidator } from "../../lib/validator.js";
import { getDb } from "../../lib/db.js";
import { login, refresh, logout } from "./service.js";
import { authMiddleware } from "./middleware.js";

function checkCsrf(c: { req: { header: (name: string) => string | undefined } }): boolean {
  return c.req.header("X-Requested-With") === "fetch";
}

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

const auth = new Hono<HonoEnv>();

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);

  const result = await login(db, body, c.env.JWT_ACCESS_SECRET);

  if (!result) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  if ("locked" in result) {
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  }

  // Set refresh token as httpOnly cookie
  setCookie(c, "refresh_token", result.refreshToken, {
    path: "/api/auth",
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return c.json({
    accessToken: result.accessToken,
    expiresAt: result.expiresAt,
    user: result.user,
  });
});

auth.post("/refresh", async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ error: "Missing required header" }, 403);
  }

  const rawToken = getCookie(c, "refresh_token");
  if (!rawToken) {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  const db = getDb(c);
  const result = await refresh(db, rawToken, c.env.JWT_ACCESS_SECRET);

  if (!result) {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  setCookie(c, "refresh_token", result.refreshToken, {
    path: "/api/auth",
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return c.json({
    accessToken: result.accessToken,
    expiresAt: result.expiresAt,
    user: result.user,
  });
});

auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = getDb(c);

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, user.tenantId));

  return c.json({
    user: {
      ...user,
      tenantName: tenant?.name ?? "",
      tenantSlug: tenant?.slug ?? "",
    },
  });
});

auth.post("/logout", async (c) => {
  if (!checkCsrf(c)) {
    return c.json({ error: "Missing required header" }, 403);
  }

  const rawToken = getCookie(c, "refresh_token");
  if (!rawToken) {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  const db = getDb(c);
  const success = await logout(db, rawToken);

  if (!success) {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  // Clear the cookie
  setCookie(c, "refresh_token", "", {
    path: "/api/auth",
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: 0,
  });

  return c.json({ success: true });
});

export default auth;
