-- 0012 — Reparación completa de RLS tras `pnpm db:push`.
--
-- Push droppea políticas y a veces el estado RLS de tablas alteradas. Este
-- archivo reaplica TODA la configuración RLS de los archivos previos:
--   0001_rls_policies.sql     (users, audit_events)
--   0002_rls_clients.sql      (clients, client_assignments, client_contacts, client_positions, client_documents)
--   0005_candidates_rls.sql   (candidates*, rejection_categories, decline_categories, privacy_notices, retention_reviews)
--   0009_position_profile_rls.sql (client_position_documents)
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.
-- Ejecutar como neondb_owner: `pnpm --filter @bepro/db db:exec drizzle/0012_repair_rls_full.sql`

-- =====================================================================
-- 1. ENABLE/FORCE RLS en cada tabla tenant-scoped.
-- =====================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE client_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_positions FORCE ROW LEVEL SECURITY;
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE candidate_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE candidate_duplicate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_duplicate_links FORCE ROW LEVEL SECURITY;
ALTER TABLE rejection_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejection_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE decline_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE decline_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE privacy_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_notices FORCE ROW LEVEL SECURITY;
ALTER TABLE retention_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE client_position_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_position_documents FORCE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. users (de 0001)
-- =====================================================================

DROP POLICY IF EXISTS users_tenant_select ON users;
CREATE POLICY users_tenant_select ON users
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS users_tenant_insert ON users;
CREATE POLICY users_tenant_insert ON users
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS users_tenant_update ON users;
CREATE POLICY users_tenant_update ON users
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS users_no_delete ON users;
CREATE POLICY users_no_delete ON users
  FOR DELETE USING (false);

-- =====================================================================
-- 3. audit_events (de 0001) — append-only
-- =====================================================================

DROP POLICY IF EXISTS audit_events_tenant_select ON audit_events;
CREATE POLICY audit_events_tenant_select ON audit_events
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS audit_events_tenant_insert ON audit_events;
CREATE POLICY audit_events_tenant_insert ON audit_events
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS audit_events_no_update ON audit_events;
CREATE POLICY audit_events_no_update ON audit_events
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS audit_events_no_delete ON audit_events;
CREATE POLICY audit_events_no_delete ON audit_events
  FOR DELETE USING (false);

-- =====================================================================
-- 4. clients (de 0002)
-- =====================================================================

DROP POLICY IF EXISTS clients_tenant_select ON clients;
CREATE POLICY clients_tenant_select ON clients
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS clients_tenant_insert ON clients;
CREATE POLICY clients_tenant_insert ON clients
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS clients_tenant_update ON clients;
CREATE POLICY clients_tenant_update ON clients
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS clients_no_delete ON clients;
CREATE POLICY clients_no_delete ON clients
  FOR DELETE USING (false);

-- =====================================================================
-- 5. client_assignments (de 0002) — hard-delete permitido
-- =====================================================================

DROP POLICY IF EXISTS client_assignments_tenant_select ON client_assignments;
CREATE POLICY client_assignments_tenant_select ON client_assignments
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_assignments_tenant_insert ON client_assignments;
CREATE POLICY client_assignments_tenant_insert ON client_assignments
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_assignments_no_update ON client_assignments;
CREATE POLICY client_assignments_no_update ON client_assignments
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS client_assignments_tenant_delete ON client_assignments;
CREATE POLICY client_assignments_tenant_delete ON client_assignments
  FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- =====================================================================
-- 6. client_contacts (de 0002) — hard-delete permitido
-- =====================================================================

DROP POLICY IF EXISTS client_contacts_tenant_select ON client_contacts;
CREATE POLICY client_contacts_tenant_select ON client_contacts
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_contacts_tenant_insert ON client_contacts;
CREATE POLICY client_contacts_tenant_insert ON client_contacts
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_contacts_tenant_update ON client_contacts;
CREATE POLICY client_contacts_tenant_update ON client_contacts
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_contacts_tenant_delete ON client_contacts;
CREATE POLICY client_contacts_tenant_delete ON client_contacts
  FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- =====================================================================
-- 7. client_positions (de 0002) — hard-delete permitido
-- =====================================================================

DROP POLICY IF EXISTS client_positions_tenant_select ON client_positions;
CREATE POLICY client_positions_tenant_select ON client_positions
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_positions_tenant_insert ON client_positions;
CREATE POLICY client_positions_tenant_insert ON client_positions
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_positions_tenant_update ON client_positions;
CREATE POLICY client_positions_tenant_update ON client_positions
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_positions_tenant_delete ON client_positions;
CREATE POLICY client_positions_tenant_delete ON client_positions
  FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- =====================================================================
-- 8. client_documents (de 0002) — hard-delete permitido
-- =====================================================================

DROP POLICY IF EXISTS client_documents_tenant_select ON client_documents;
CREATE POLICY client_documents_tenant_select ON client_documents
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_documents_tenant_insert ON client_documents;
CREATE POLICY client_documents_tenant_insert ON client_documents
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_documents_no_update ON client_documents;
CREATE POLICY client_documents_no_update ON client_documents
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS client_documents_tenant_delete ON client_documents;
CREATE POLICY client_documents_tenant_delete ON client_documents
  FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- =====================================================================
-- 9. candidates (de 0005)
-- =====================================================================

DROP POLICY IF EXISTS candidates_tenant_select ON candidates;
CREATE POLICY candidates_tenant_select ON candidates
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS candidates_tenant_insert ON candidates;
CREATE POLICY candidates_tenant_insert ON candidates
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS candidates_tenant_update ON candidates;
CREATE POLICY candidates_tenant_update ON candidates
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS candidates_no_delete ON candidates;
CREATE POLICY candidates_no_delete ON candidates
  FOR DELETE USING (false);

-- =====================================================================
-- 10. candidate_attachments (de 0005)
-- =====================================================================

DROP POLICY IF EXISTS attachments_tenant_select ON candidate_attachments;
CREATE POLICY attachments_tenant_select ON candidate_attachments
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS attachments_tenant_insert ON candidate_attachments;
CREATE POLICY attachments_tenant_insert ON candidate_attachments
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS attachments_tenant_update ON candidate_attachments;
CREATE POLICY attachments_tenant_update ON candidate_attachments
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS attachments_no_delete ON candidate_attachments;
CREATE POLICY attachments_no_delete ON candidate_attachments
  FOR DELETE USING (false);

-- =====================================================================
-- 11. candidate_duplicate_links (de 0005) — append-only
-- =====================================================================

DROP POLICY IF EXISTS dup_links_tenant_select ON candidate_duplicate_links;
CREATE POLICY dup_links_tenant_select ON candidate_duplicate_links
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS dup_links_tenant_insert ON candidate_duplicate_links;
CREATE POLICY dup_links_tenant_insert ON candidate_duplicate_links
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS dup_links_no_update ON candidate_duplicate_links;
CREATE POLICY dup_links_no_update ON candidate_duplicate_links
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS dup_links_no_delete ON candidate_duplicate_links;
CREATE POLICY dup_links_no_delete ON candidate_duplicate_links
  FOR DELETE USING (false);

-- =====================================================================
-- 12. rejection_categories (de 0005)
-- =====================================================================

DROP POLICY IF EXISTS rej_cat_tenant_select ON rejection_categories;
CREATE POLICY rej_cat_tenant_select ON rejection_categories
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rej_cat_tenant_insert ON rejection_categories;
CREATE POLICY rej_cat_tenant_insert ON rejection_categories
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rej_cat_tenant_update ON rejection_categories;
CREATE POLICY rej_cat_tenant_update ON rejection_categories
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rej_cat_no_delete ON rejection_categories;
CREATE POLICY rej_cat_no_delete ON rejection_categories
  FOR DELETE USING (false);

-- =====================================================================
-- 13. decline_categories (de 0005)
-- =====================================================================

DROP POLICY IF EXISTS dec_cat_tenant_select ON decline_categories;
CREATE POLICY dec_cat_tenant_select ON decline_categories
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS dec_cat_tenant_insert ON decline_categories;
CREATE POLICY dec_cat_tenant_insert ON decline_categories
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS dec_cat_tenant_update ON decline_categories;
CREATE POLICY dec_cat_tenant_update ON decline_categories
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS dec_cat_no_delete ON decline_categories;
CREATE POLICY dec_cat_no_delete ON decline_categories
  FOR DELETE USING (false);

-- =====================================================================
-- 14. privacy_notices (de 0005)
-- =====================================================================

DROP POLICY IF EXISTS pn_tenant_select ON privacy_notices;
CREATE POLICY pn_tenant_select ON privacy_notices
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS pn_tenant_insert ON privacy_notices;
CREATE POLICY pn_tenant_insert ON privacy_notices
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS pn_tenant_update ON privacy_notices;
CREATE POLICY pn_tenant_update ON privacy_notices
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS pn_no_delete ON privacy_notices;
CREATE POLICY pn_no_delete ON privacy_notices
  FOR DELETE USING (false);

-- =====================================================================
-- 15. retention_reviews (de 0005) — append-only
-- =====================================================================

DROP POLICY IF EXISTS rr_tenant_select ON retention_reviews;
CREATE POLICY rr_tenant_select ON retention_reviews
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rr_tenant_insert ON retention_reviews;
CREATE POLICY rr_tenant_insert ON retention_reviews
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS rr_no_update ON retention_reviews;
CREATE POLICY rr_no_update ON retention_reviews
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS rr_no_delete ON retention_reviews;
CREATE POLICY rr_no_delete ON retention_reviews
  FOR DELETE USING (false);

-- =====================================================================
-- 16. client_position_documents (de 0009) — soft-delete only
-- =====================================================================

DROP POLICY IF EXISTS client_position_documents_tenant_select ON client_position_documents;
CREATE POLICY client_position_documents_tenant_select ON client_position_documents
  FOR SELECT TO app_worker
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_position_documents_tenant_insert ON client_position_documents;
CREATE POLICY client_position_documents_tenant_insert ON client_position_documents
  FOR INSERT TO app_worker
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_position_documents_tenant_update ON client_position_documents;
CREATE POLICY client_position_documents_tenant_update ON client_position_documents
  FOR UPDATE TO app_worker
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS client_position_documents_no_delete ON client_position_documents;
CREATE POLICY client_position_documents_no_delete ON client_position_documents
  FOR DELETE TO app_worker
  USING (false);

-- =====================================================================
-- 17. Re-grants para app_worker (de 0008) — push puede haber alterado privilegios
-- =====================================================================

GRANT USAGE ON SCHEMA public TO app_worker;
GRANT SELECT ON tenants TO app_worker;
GRANT SELECT, INSERT, UPDATE ON users TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO app_worker;
GRANT SELECT, INSERT, UPDATE ON clients TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_assignments TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_contacts TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_positions TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_documents TO app_worker;
GRANT SELECT, INSERT, UPDATE ON candidates TO app_worker;
GRANT SELECT, INSERT, UPDATE ON candidate_attachments TO app_worker;
GRANT SELECT, INSERT ON candidate_duplicate_links TO app_worker;
GRANT SELECT, INSERT, UPDATE ON rejection_categories TO app_worker;
GRANT SELECT, INSERT, UPDATE ON decline_categories TO app_worker;
GRANT SELECT, INSERT, UPDATE ON privacy_notices TO app_worker;
GRANT SELECT, INSERT ON retention_reviews TO app_worker;
GRANT SELECT, INSERT ON audit_events TO app_worker;
GRANT SELECT, INSERT, UPDATE ON client_position_documents TO app_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_worker;
