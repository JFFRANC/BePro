import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants.js";
import { users } from "./users.js";
import { clientPositions } from "./client-positions.js";

// 011-puestos-profile-docs — Tipo de documento por puesto
export const positionDocumentTypeEnum = pgEnum("position_document_type", [
  "contract",
  "pase_visita",
]);

export const clientPositionDocuments = pgTable(
  "client_position_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    positionId: uuid("position_id")
      .notNull()
      .references(() => clientPositions.id),
    type: positionDocumentTypeEnum("type").notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
    replacedAt: timestamp("replaced_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("client_position_documents_tenant_id_idx").on(table.tenantId),
    index("client_position_documents_position_id_idx").on(table.positionId),
    // Partial unique index — at most one active doc per (tenant, position, type)
    uniqueIndex("client_position_documents_active_uq")
      .on(table.tenantId, table.positionId, table.type)
      .where(sql`is_active = true`),
  ],
);

export type ClientPositionDocumentRow =
  typeof clientPositionDocuments.$inferSelect;
export type ClientPositionDocumentInsert =
  typeof clientPositionDocuments.$inferInsert;
