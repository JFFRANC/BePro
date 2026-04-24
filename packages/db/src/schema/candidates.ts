import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  jsonb,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants.js";
import { clients } from "./clients.js";
import { users } from "./users.js";
import { rejectionCategories } from "./rejection-categories.js";
import { declineCategories } from "./decline-categories.js";
import { privacyNotices } from "./privacy-notices.js";

// Enum del FSM de 14 estados (R1)
export const candidateStatusEnum = pgEnum("candidate_status", [
  "registered",
  "interview_scheduled",
  "attended",
  "pending",
  "approved",
  "hired",
  "in_guarantee",
  "guarantee_met",
  "rejected",
  "declined",
  "no_show",
  "termination",
  "discarded",
  "replacement",
]);

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    registeringUserId: uuid("registering_user_id")
      .notNull()
      .references(() => users.id),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    phoneNormalized: varchar("phone_normalized", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    currentPosition: varchar("current_position", { length: 200 }),
    source: varchar("source", { length: 100 }).notNull(),
    status: candidateStatusEnum("status").notNull().default("registered"),
    additionalFields: jsonb("additional_fields").notNull().default({}),
    rejectionCategoryId: uuid("rejection_category_id").references(
      () => rejectionCategories.id,
    ),
    declineCategoryId: uuid("decline_category_id").references(
      () => declineCategories.id,
    ),
    privacyNoticeId: uuid("privacy_notice_id")
      .notNull()
      .references(() => privacyNotices.id),
    privacyNoticeAcknowledgedAt: timestamp("privacy_notice_acknowledged_at", {
      withTimezone: true,
    }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("candidates_tenant_client_status_idx")
      .on(table.tenantId, table.clientId, table.status)
      .where(sql`${table.isActive} = true`),
    index("candidates_tenant_recruiter_idx")
      .on(table.tenantId, table.registeringUserId)
      .where(sql`${table.isActive} = true`),
    index("candidates_dup_idx")
      .on(table.tenantId, table.phoneNormalized, table.clientId)
      .where(sql`${table.isActive} = true`),
    index("candidates_updated_idx").on(
      table.tenantId,
      sql`${table.updatedAt} DESC`,
    ),
    check(
      "candidates_phone_normalized_digits",
      sql`${table.phoneNormalized} ~ '^[0-9]+$'`,
    ),
    check(
      "candidates_rejected_requires_category",
      sql`${table.status} <> 'rejected' OR ${table.rejectionCategoryId} IS NOT NULL`,
    ),
    check(
      "candidates_declined_requires_category",
      sql`${table.status} <> 'declined' OR ${table.declineCategoryId} IS NOT NULL`,
    ),
  ],
);

export type CandidateRow = typeof candidates.$inferSelect;
export type CandidateInsert = typeof candidates.$inferInsert;
