-- Feature 009 (password reset) — schema migration.
--
-- BEFORE applying, run the audit query from research.md Decision 5:
--   SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;
-- Expect 0 rows. Any row means at least one email is shared across tenants;
-- halt and reconcile with the team before continuing.
--
-- The unique-constraint swap and table create run inside a single transaction
-- so a failure (e.g. duplicate email) leaves the existing constraint intact.

BEGIN;

-- 1. Promote users.email to a globally unique constraint (FR-015).
ALTER TABLE users DROP CONSTRAINT users_tenant_email_uq;
ALTER TABLE users ADD CONSTRAINT users_email_uq UNIQUE (email);

-- 2. Create the password_reset_tokens table.
CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  ip_hash varchar(64),
  user_agent varchar(512),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_reset_tokens_token_hash_idx
  ON password_reset_tokens(token_hash);

CREATE INDEX password_reset_tokens_user_id_idx
  ON password_reset_tokens(user_id);

CREATE INDEX password_reset_tokens_expires_at_idx
  ON password_reset_tokens(expires_at);

COMMIT;
