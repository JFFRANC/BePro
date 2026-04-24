import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants.js";

export const privacyNotices = pgTable(
  "privacy_notices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    version: varchar("version", { length: 20 }).notNull(),
    textMd: text("text_md").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("privacy_notices_tenant_version_uniq").on(
      table.tenantId,
      table.version,
    ),
    uniqueIndex("privacy_notices_tenant_active_uniq")
      .on(table.tenantId)
      .where(sql`${table.isActive} = true`),
  ],
);

export type PrivacyNoticeRow = typeof privacyNotices.$inferSelect;
