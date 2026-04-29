// Cloudflare Cron Trigger entry. Configured in `wrangler.jsonc`:
//   "triggers": { "crons": ["0 3 * * *"] }   // daily at 03:00 UTC
//
// Sole job today: hard-delete used / expired password-reset token rows
// (FR-017, research.md Decision 4). The handler is idempotent and a missed
// run is self-correcting at the next tick — no operator alerting needed.

import { isNotNull, lt, or, sql } from "drizzle-orm";
import { passwordResetTokens } from "@bepro/db";
import { createDb } from "@bepro/db";
import type { Bindings } from "./types.js";

export async function cleanupExpiredResetTokens(env: Bindings): Promise<void> {
  const db = createDb(env.DATABASE_URL);
  await db
    .delete(passwordResetTokens)
    .where(
      or(
        isNotNull(passwordResetTokens.usedAt),
        lt(passwordResetTokens.expiresAt, sql`now()`),
      ),
    );
}

export const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (
  _event,
  env,
  ctx,
) => {
  ctx.waitUntil(cleanupExpiredResetTokens(env));
};
