import type { Context, MiddlewareHandler } from "hono";
import { verify } from "hono/jwt";
import { eq, sql } from "drizzle-orm";
import type { UserRole } from "@bepro/shared";
import { tenants } from "@bepro/db";
import type { HonoEnv } from "../../types.js";
import { getDb } from "../../lib/db.js";
import type { JwtPayload } from "./types.js";

export const authMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = (await verify(token, c.env.JWT_ACCESS_SECRET, "HS256")) as unknown as JwtPayload;

    c.set("user", {
      id: payload.sub,
      email: payload.email,
      firstName: "",
      lastName: "",
      role: payload.role,
      tenantId: payload.tenantId,
      isFreelancer: payload.isFreelancer,
    });

    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
};

export const tenantMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const user = c.get("user");
  const db = getDb(c);

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, user.tenantId));

  if (!tenant || !tenant.isActive) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("tenantId", tenant.id);

  // Wrap downstream handlers in a transaction with SET LOCAL for RLS enforcement
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.tenant_id = ${tenant.id}`);
    c.set("db", tx as unknown as typeof db);
    await next();
  });
};

export function requireRole(
  ...roles: UserRole[]
): MiddlewareHandler<HonoEnv> {
  return async (c: Context<HonoEnv>, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
}
