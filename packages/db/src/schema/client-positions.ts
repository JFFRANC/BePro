import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  boolean,
  smallint,
  numeric,
  text,
  timestamp,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants.js";
import { clients } from "./clients.js";

// 011-puestos-profile-docs — Position profile pg_enums
export const positionGenderEnum = pgEnum("position_gender", [
  "masculino",
  "femenino",
  "indistinto",
]);

export const positionCivilStatusEnum = pgEnum("position_civil_status", [
  "soltero",
  "casado",
  "indistinto",
]);

export const positionEducationLevelEnum = pgEnum("position_education_level", [
  "ninguna",
  "primaria",
  "secundaria",
  "preparatoria",
  "tecnica",
  "licenciatura",
  "posgrado",
]);

export const positionPaymentFrequencyEnum = pgEnum(
  "position_payment_frequency",
  ["weekly", "biweekly", "monthly"],
);

export const positionShiftEnum = pgEnum("position_shift", [
  "fixed",
  "rotating",
]);

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
    // 011 — Profile fields (every column nullable)
    vacancies: smallint("vacancies"),
    workLocation: varchar("work_location", { length: 500 }),
    ageMin: smallint("age_min"),
    ageMax: smallint("age_max"),
    gender: positionGenderEnum("gender"),
    civilStatus: positionCivilStatusEnum("civil_status"),
    educationLevel: positionEducationLevelEnum("education_level"),
    experienceText: text("experience_text"),
    salaryAmount: numeric("salary_amount", { precision: 10, scale: 2 }),
    salaryCurrency: varchar("salary_currency", { length: 3 }).default("MXN"),
    paymentFrequency: positionPaymentFrequencyEnum("payment_frequency"),
    salaryNotes: text("salary_notes"),
    benefits: text("benefits"),
    scheduleText: text("schedule_text"),
    workDays: text("work_days").array(),
    shift: positionShiftEnum("shift"),
    requiredDocuments: text("required_documents").array(),
    responsibilities: text("responsibilities"),
    faq: text("faq").array(),
  },
  (table) => [
    unique("client_positions_tenant_client_name_uq").on(
      table.tenantId,
      table.clientId,
      table.name,
    ),
    index("client_positions_tenant_id_idx").on(table.tenantId),
    index("client_positions_client_id_idx").on(table.clientId),
    check(
      "client_positions_age_range_chk",
      sql`age_min IS NULL OR age_max IS NULL OR age_min <= age_max`,
    ),
    check(
      "client_positions_work_days_chk",
      sql`work_days IS NULL OR work_days <@ ARRAY['mon','tue','wed','thu','fri','sat','sun']::text[]`,
    ),
    check(
      "client_positions_vacancies_chk",
      sql`vacancies IS NULL OR vacancies >= 1`,
    ),
  ],
);
