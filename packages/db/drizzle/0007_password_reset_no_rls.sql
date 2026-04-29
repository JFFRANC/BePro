-- Feature 009 (password reset) — GRANT only, no RLS.
--
-- password_reset_tokens is intentionally NOT RLS-scoped. Rationale: the table
-- is a pre-authentication artifact; no tenant context exists at issuance time
-- (the public POST /api/auth/password-reset/request endpoint is not behind any
-- tenant resolution middleware). Ownership is enforced by the user_id FK and
-- isolation by the fact that the public endpoints expose no tenant signal
-- (see spec FR-001, FR-002, FR-015).
--
-- This file exists to keep the manual GRANT/REVOKE pattern consistent with
-- 0001_rls_policies.sql, 0002_rls_clients.sql, 0005_candidates_rls.sql.
-- Mirrors the refresh_tokens design (see packages/db/CLAUDE.md
-- §"Tables Without RLS").

-- DELETE is needed for the daily cleanup cron handler (FR-017, T057).
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO app_worker;
