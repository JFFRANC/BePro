import { createDb, type Database } from "@bepro/db";
import type { Context } from "hono";
import type { HonoEnv } from "../types.js";

export function getDb(c: Context<HonoEnv>): Database {
  return createDb(c.env.DATABASE_URL);
}
