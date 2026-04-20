-- RLS policies para tablas del módulo de clientes
-- Aplicar después de la migración de schema

-- ========================================
-- clients table
-- ========================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

CREATE POLICY clients_tenant_select ON clients
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY clients_tenant_insert ON clients
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY clients_tenant_update ON clients
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Soft delete only — no hard delete
CREATE POLICY clients_no_delete ON clients
  FOR DELETE
  USING (false);

-- ========================================
-- client_assignments table
-- ========================================

ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY client_assignments_tenant_select ON client_assignments
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY client_assignments_tenant_insert ON client_assignments
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- No update — assignments are created or deleted
CREATE POLICY client_assignments_no_update ON client_assignments
  FOR UPDATE
  USING (false);

-- Hard delete allowed
CREATE POLICY client_assignments_tenant_delete ON client_assignments
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ========================================
-- client_contacts table
-- ========================================

ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY client_contacts_tenant_select ON client_contacts
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY client_contacts_tenant_insert ON client_contacts
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY client_contacts_tenant_update ON client_contacts
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Hard delete allowed (contactos comerciales, no PII protegido por LFPDPPP)
CREATE POLICY client_contacts_tenant_delete ON client_contacts
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ========================================
-- client_positions table
-- ========================================

ALTER TABLE client_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_positions FORCE ROW LEVEL SECURITY;

CREATE POLICY client_positions_tenant_select ON client_positions
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY client_positions_tenant_insert ON client_positions
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY client_positions_tenant_update ON client_positions
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Hard delete allowed (soft delete se maneja a nivel de aplicación cuando hay candidatos)
CREATE POLICY client_positions_tenant_delete ON client_positions
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- ========================================
-- client_documents table
-- ========================================

ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY client_documents_tenant_select ON client_documents
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY client_documents_tenant_insert ON client_documents
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- No update — documentos son inmutables (se eliminan y resuben)
CREATE POLICY client_documents_no_update ON client_documents
  FOR UPDATE
  USING (false);

-- Hard delete allowed (se elimina también el archivo en R2)
CREATE POLICY client_documents_tenant_delete ON client_documents
  FOR DELETE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
