-- 011-puestos-profile-docs — RLS policies for client_position_documents
-- Mirror del shape usado en 0002_rls_clients.sql para tablas tenant-scoped.
-- Soft-delete only — DELETE bloqueado a nivel RLS (LFPDPPP).
-- IDEMPOTENT: rerun-safe (DO blocks for CREATE POLICY).

-- ========================================
-- client_position_documents
-- ========================================

ALTER TABLE client_position_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_position_documents FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY client_position_documents_tenant_select ON client_position_documents
    FOR SELECT TO app_worker
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY client_position_documents_tenant_insert ON client_position_documents
    FOR INSERT TO app_worker
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY client_position_documents_tenant_update ON client_position_documents
    FOR UPDATE TO app_worker
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Hard-delete forbidden — soft delete only (LFPDPPP)
DO $$ BEGIN
  CREATE POLICY client_position_documents_no_delete ON client_position_documents
    FOR DELETE TO app_worker
    USING (false);
EXCEPTION WHEN duplicate_object THEN null; END $$;

GRANT SELECT, INSERT, UPDATE ON client_position_documents TO app_worker;
