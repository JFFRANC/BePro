-- 011-puestos-profile-docs — Migration 0009
-- Schema delta para perfil completo de puestos + tabla de documentos por puesto.
--
-- 1. Crea 6 pg_enums (gender / civil_status / education_level / payment_frequency / shift / document_type).
-- 2. Extiende `client_positions` con 18 columnas nullable + 3 CHECK constraints.
-- 3. Crea `client_position_documents` con FKs e índices (incluye partial unique).
--
-- IDEMPOTENT: usa IF NOT EXISTS / IF EXISTS donde aplica para soportar re-ejecución.

-- ========================================
-- 1. pg_enums
-- ========================================

DO $$ BEGIN
  CREATE TYPE "position_gender" AS ENUM ('masculino', 'femenino', 'indistinto');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "position_civil_status" AS ENUM ('soltero', 'casado', 'indistinto');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "position_education_level" AS ENUM (
    'ninguna', 'primaria', 'secundaria', 'preparatoria',
    'tecnica', 'licenciatura', 'posgrado'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "position_payment_frequency" AS ENUM ('weekly', 'biweekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "position_shift" AS ENUM ('fixed', 'rotating');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "position_document_type" AS ENUM ('contract', 'pase_visita');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- ========================================
-- 2. client_positions — 18 columnas nuevas
-- ========================================

ALTER TABLE "client_positions"
  ADD COLUMN IF NOT EXISTS "vacancies" smallint,
  ADD COLUMN IF NOT EXISTS "work_location" varchar(500),
  ADD COLUMN IF NOT EXISTS "age_min" smallint,
  ADD COLUMN IF NOT EXISTS "age_max" smallint,
  ADD COLUMN IF NOT EXISTS "gender" "position_gender",
  ADD COLUMN IF NOT EXISTS "civil_status" "position_civil_status",
  ADD COLUMN IF NOT EXISTS "education_level" "position_education_level",
  ADD COLUMN IF NOT EXISTS "experience_text" text,
  ADD COLUMN IF NOT EXISTS "salary_amount" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "salary_currency" varchar(3) DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS "payment_frequency" "position_payment_frequency",
  ADD COLUMN IF NOT EXISTS "salary_notes" text,
  ADD COLUMN IF NOT EXISTS "benefits" text,
  ADD COLUMN IF NOT EXISTS "schedule_text" text,
  ADD COLUMN IF NOT EXISTS "work_days" text[],
  ADD COLUMN IF NOT EXISTS "shift" "position_shift",
  ADD COLUMN IF NOT EXISTS "required_documents" text[],
  ADD COLUMN IF NOT EXISTS "responsibilities" text,
  ADD COLUMN IF NOT EXISTS "faq" text[];
--> statement-breakpoint

-- 3 CHECK constraints — añadidos vía DO para idempotencia.
DO $$ BEGIN
  ALTER TABLE "client_positions"
    ADD CONSTRAINT "client_positions_age_range_chk"
    CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max);
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "client_positions"
    ADD CONSTRAINT "client_positions_work_days_chk"
    CHECK (
      work_days IS NULL OR
      work_days <@ ARRAY['mon','tue','wed','thu','fri','sat','sun']::text[]
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "client_positions"
    ADD CONSTRAINT "client_positions_vacancies_chk"
    CHECK (vacancies IS NULL OR vacancies >= 1);
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- ========================================
-- 3. client_position_documents — tabla nueva
-- ========================================

CREATE TABLE IF NOT EXISTS "client_position_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "position_id" uuid NOT NULL,
  "type" "position_document_type" NOT NULL,
  "original_name" varchar(255) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "size_bytes" integer NOT NULL,
  "storage_key" varchar(500) NOT NULL,
  "uploaded_by" uuid NOT NULL,
  "uploaded_at" timestamp with time zone,
  "replaced_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "client_position_documents"
    ADD CONSTRAINT "client_position_documents_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "client_position_documents"
    ADD CONSTRAINT "client_position_documents_position_id_client_positions_id_fk"
    FOREIGN KEY ("position_id") REFERENCES "public"."client_positions"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "client_position_documents"
    ADD CONSTRAINT "client_position_documents_uploaded_by_users_id_fk"
    FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "client_position_documents_tenant_id_idx"
  ON "client_position_documents" USING btree ("tenant_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "client_position_documents_position_id_idx"
  ON "client_position_documents" USING btree ("position_id");
--> statement-breakpoint

-- Partial unique index — at most 1 active doc per (tenant, position, type)
CREATE UNIQUE INDEX IF NOT EXISTS "client_position_documents_active_uq"
  ON "client_position_documents" ("tenant_id", "position_id", "type")
  WHERE is_active = true;
