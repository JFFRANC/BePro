-- 012-client-detail-ux — adds clients.description (text, ≤2000) and
-- client_contacts.position (varchar(120)). No data backfill: existing rows
-- get NULL and the UI handles that gracefully (E-01, E-03).
--
-- RLS: both columns inherit existing tenant_id-scoped policies from
-- 0002_rls_clients.sql. No new policies needed.
--
-- Apply via:
--   pnpm --filter @bepro/db db:exec packages/db/drizzle/0011_client_description_contact_position.sql
-- Do NOT use db:push (memory: feedback_db_push_safety).

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS description text NULL;

ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS clients_description_max_length;

ALTER TABLE clients
  ADD CONSTRAINT clients_description_max_length
  CHECK (description IS NULL OR char_length(description) <= 2000);

ALTER TABLE client_contacts
  ADD COLUMN IF NOT EXISTS position varchar(120) NULL;
