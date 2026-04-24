import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const retentionReviews = pgTable(
  "retention_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    reviewerUserId: uuid("reviewer_user_id")
      .notNull()
      .references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(),
    justificationText: text("justification_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("retention_reviews_tenant_due_idx").on(
      table.tenantId,
      sql`${table.nextDueAt} DESC`,
    ),
  ],
);

export type RetentionReviewRow = typeof retentionReviews.$inferSelect;
