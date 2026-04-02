import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    family: uuid("family").notNull(),
    isRevoked: boolean("is_revoked").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("refresh_tokens_token_hash_idx").on(table.tokenHash),
    index("refresh_tokens_user_family_idx").on(table.userId, table.family),
    index("refresh_tokens_expires_at_idx").on(table.expiresAt),
  ],
);
