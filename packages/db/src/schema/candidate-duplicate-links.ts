import { pgTable, uuid, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { users } from "./users.js";
import { candidates } from "./candidates.js";

export const candidateDuplicateLinks = pgTable(
  "candidate_duplicate_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    candidateId: uuid("candidate_id")
      .notNull()
      .references(() => candidates.id),
    duplicateOfCandidateId: uuid("duplicate_of_candidate_id")
      .notNull()
      .references(() => candidates.id),
    confirmedByUserId: uuid("confirmed_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("dup_links_candidate_idx").on(table.tenantId, table.candidateId),
    index("dup_links_reverse_idx").on(
      table.tenantId,
      table.duplicateOfCandidateId,
    ),
  ],
);

export type CandidateDuplicateLinkRow =
  typeof candidateDuplicateLinks.$inferSelect;
