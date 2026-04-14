import { createDb, type Database } from "@bepro/db";
import type { Context } from "hono";
import type { HonoEnv } from "../types.js";

// Each Workers request is isolated — Pool is short-lived and GC'd when the request ends.
// No explicit pool.end() needed; the Neon proxy handles connection cleanup.
export function getDb(c: Context<HonoEnv>): Database {
  return createDb(c.env.DATABASE_URL);
}
