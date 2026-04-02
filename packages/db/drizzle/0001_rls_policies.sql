-- RLS policies for multi-tenant isolation
-- Applied after the initial schema migration

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- SELECT: only rows matching the current tenant
CREATE POLICY users_tenant_select ON users
  FOR SELECT
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- INSERT: only rows for the current tenant
CREATE POLICY users_tenant_insert ON users
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- UPDATE: only rows for the current tenant
CREATE POLICY users_tenant_update ON users
  FOR UPDATE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- DELETE: blocked entirely (soft delete only per LFPDPPP)
CREATE POLICY users_no_delete ON users
  FOR DELETE
  USING (false);
