import {
  pgTable,
  uuid,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { clients } from "./clients.js";
import { users } from "./users.js";

export const clientAssignments = pgTable(
  "client_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    accountExecutiveId: uuid("account_executive_id").references(
      () => users.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("client_assignments_tenant_client_user_uq").on(
      table.tenantId,
      table.clientId,
      table.userId,
    ),
    index("client_assignments_tenant_id_idx").on(table.tenantId),
    index("client_assignments_client_id_idx").on(table.clientId),
    index("client_assignments_user_id_idx").on(table.userId),
  ],
);
