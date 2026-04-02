import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    role: varchar("role", { length: 30 }).notNull(),
    isFreelancer: boolean("is_freelancer").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    firstFailedAt: timestamp("first_failed_at", { withTimezone: true }),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("users_tenant_email_uq").on(table.tenantId, table.email),
    index("users_tenant_id_idx").on(table.tenantId),
  ],
);
