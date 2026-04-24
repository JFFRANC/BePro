import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants.js";
import { users } from "./users.js";
import { candidates } from "./candidates.js";

export const candidateAttachments = pgTable(
  "candidate_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    uploaderUserId: uuid("uploader_user_id")
      .notNull()
      .references(() => users.id),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    tag: varchar("tag", { length: 50 }),
    isObsolete: boolean("is_obsolete").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attachments_candidate_idx")
      .on(table.tenantId, table.candidateId)
      .where(sql`${table.isActive} = true AND NOT ${table.isObsolete}`),
    check(
      "candidate_attachments_size_cap",
      sql`${table.sizeBytes} > 0 AND ${table.sizeBytes} <= 10485760`,
    ),
  ],
);

export type CandidateAttachmentRow = typeof candidateAttachments.$inferSelect;
