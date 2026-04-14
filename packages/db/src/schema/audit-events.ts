import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    actorId: uuid("actor_id").notNull(),
    action: varchar("action", { length: 50 }).notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: uuid("target_id").notNull(),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_tenant_id_idx").on(table.tenantId),
    index("audit_events_target_idx").on(
      table.tenantId,
      table.targetType,
      table.targetId,
    ),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);
