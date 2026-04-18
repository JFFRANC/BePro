import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { clients } from "./clients.js";

export const clientPositions = pgTable(
  "client_positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    name: varchar("name", { length: 200 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("client_positions_tenant_client_name_uq").on(
      table.tenantId,
      table.clientId,
      table.name,
    ),
    index("client_positions_tenant_id_idx").on(table.tenantId),
    index("client_positions_client_id_idx").on(table.clientId),
  ],
);
