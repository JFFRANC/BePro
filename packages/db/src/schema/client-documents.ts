import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { clients } from "./clients.js";
import { users } from "./users.js";

export const clientDocuments = pgTable(
  "client_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    documentType: varchar("document_type", { length: 30 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("client_documents_tenant_id_idx").on(table.tenantId),
    index("client_documents_client_id_idx").on(table.clientId),
  ],
);
