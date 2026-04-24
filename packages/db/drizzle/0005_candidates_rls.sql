-- 007-candidates-module — paso 3: políticas RLS para todas las tablas nuevas
-- Patrón estándar (ver packages/db/CLAUDE.md y 0001_rls_policies.sql)

-- ========================================
-- candidates
-- ========================================

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;

CREATE POLICY candidates_tenant_select ON candidates
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY candidates_tenant_insert ON candidates
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY candidates_tenant_update ON candidates
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Soft-delete only (FR-003): hard DELETE bloqueado
CREATE POLICY candidates_no_delete ON candidates
  FOR DELETE USING (false);

-- ========================================
-- candidate_attachments
-- ========================================

ALTER TABLE candidate_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_attachments FORCE ROW LEVEL SECURITY;

CREATE POLICY attachments_tenant_select ON candidate_attachments
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY attachments_tenant_insert ON candidate_attachments
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY attachments_tenant_update ON candidate_attachments
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY attachments_no_delete ON candidate_attachments
  FOR DELETE USING (false);

-- ========================================
-- candidate_duplicate_links
-- ========================================

ALTER TABLE candidate_duplicate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_duplicate_links FORCE ROW LEVEL SECURITY;

CREATE POLICY dup_links_tenant_select ON candidate_duplicate_links
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY dup_links_tenant_insert ON candidate_duplicate_links
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Append-only: nunca se actualizan ni borran
CREATE POLICY dup_links_no_update ON candidate_duplicate_links
  FOR UPDATE USING (false);

CREATE POLICY dup_links_no_delete ON candidate_duplicate_links
  FOR DELETE USING (false);

-- ========================================
-- rejection_categories
-- ========================================

ALTER TABLE rejection_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rejection_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY rej_cat_tenant_select ON rejection_categories
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY rej_cat_tenant_insert ON rejection_categories
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY rej_cat_tenant_update ON rejection_categories
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY rej_cat_no_delete ON rejection_categories
  FOR DELETE USING (false);

-- ========================================
-- decline_categories
-- ========================================

ALTER TABLE decline_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE decline_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY dec_cat_tenant_select ON decline_categories
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY dec_cat_tenant_insert ON decline_categories
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY dec_cat_tenant_update ON decline_categories
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY dec_cat_no_delete ON decline_categories
  FOR DELETE USING (false);

-- ========================================
-- privacy_notices
-- ========================================

ALTER TABLE privacy_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_notices FORCE ROW LEVEL SECURITY;

CREATE POLICY pn_tenant_select ON privacy_notices
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pn_tenant_insert ON privacy_notices
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pn_tenant_update ON privacy_notices
  FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY pn_no_delete ON privacy_notices
  FOR DELETE USING (false);

-- ========================================
-- retention_reviews
-- ========================================

ALTER TABLE retention_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_reviews FORCE ROW LEVEL SECURITY;

CREATE POLICY rr_tenant_select ON retention_reviews
  FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY rr_tenant_insert ON retention_reviews
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Append-only (FR-003a)
CREATE POLICY rr_no_update ON retention_reviews
  FOR UPDATE USING (false);

CREATE POLICY rr_no_delete ON retention_reviews
  FOR DELETE USING (false);
