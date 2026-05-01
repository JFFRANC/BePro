import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { clients } from "./clients.js";

export const clientContacts = pgTable(
  "client_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    name: varchar("name", { length: 200 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    // 012-client-detail-ux — cargo / puesto del contacto (opcional).
    position: varchar("position", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("client_contacts_tenant_client_email_uq").on(
      table.tenantId,
      table.clientId,
      table.email,
    ),
    index("client_contacts_tenant_id_idx").on(table.tenantId),
    index("client_contacts_client_id_idx").on(table.clientId),
  ],
);
