# Data Model: Password Reset (009)

## Entities touched

### 1. `password_reset_tokens` — NEW

Pre-authentication artifact. Not RLS-scoped (no tenant context at the time of issuance). Ownership enforced by FK to `users.id`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` ON DELETE CASCADE | Cascade is safe — token only exists while user exists. |
| `token_hash` | `varchar(64)` | NOT NULL | Lowercase hex of `SHA-256(token)`. 64 chars exact. |
| `expires_at` | `timestamptz` | NOT NULL | Issuance timestamp + 30 minutes. |
| `used_at` | `timestamptz` | NULL until consumed | Set inside the confirm transaction. |
| `ip_hash` | `varchar(64)` | NULL | Hex of `SHA-256(client_ip + secret_pepper)` if available; NULL if not resolvable in Workers. Forensic only — never logged. |
| `user_agent` | `varchar(512)` | NULL | Truncated raw UA string. Forensic only. |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes**:
- `password_reset_tokens_token_hash_idx` on `(token_hash)` — primary lookup path. UNIQUE is *not* required at the index level (a SHA-256 collision is astronomically unlikely and is not a security event because the underlying random tokens are themselves unique with overwhelming probability), but the lookup is index-only.
- `password_reset_tokens_user_id_idx` on `(user_id)` — used by the "invalidate older pending tokens" path on new issuance.
- `password_reset_tokens_expires_at_idx` on `(expires_at)` — used by the daily cleanup cron.

**RLS**: Disabled (mirrors `refresh_tokens`). Documented explicitly in `0007_password_reset_no_rls.sql` so future readers know the omission is intentional.

**Lifecycle**:
- Created by `POST /api/auth/password-reset/request` when an active user exists for the supplied email and the per-email rate-limit allows it. At the same moment, all earlier rows for the same `user_id` where `used_at IS NULL AND expires_at > now()` are marked used (`UPDATE … SET used_at = now()`) so only the newest token validates (FR-004).
- Consumed by `POST /api/auth/password-reset/confirm` — `used_at` set inside the transaction.
- Hard-deleted by the daily cron (FR-017) once `used_at IS NOT NULL OR expires_at < now()`.

### 2. `users` — MODIFIED

| Change | SQL |
|---|---|
| Drop composite unique | `ALTER TABLE users DROP CONSTRAINT users_tenant_email_uq;` |
| Add global unique | `ALTER TABLE users ADD CONSTRAINT users_email_uq UNIQUE (email);` |

No new columns. Existing columns updated by the confirm transaction:
- `password_hash` → new bcrypt hash (cost ≥ 12).
- `failed_login_count` → `0` (FR-016).
- `first_failed_at` → `NULL` (FR-016, consistency with reset path of `auth/service.ts:108-113`).
- `locked_until` → `NULL` (FR-016).
- `must_change_password` → `false` (the user just chose this password themselves; the force-change flag is for admin-provisioned passwords).
- `updated_at` → `now()`.

**Audit step required before applying the migration** (research.md Decision 5): run `SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;`. If any rows return, halt and reconcile with the team before proceeding.

### 3. `refresh_tokens` — READ + WRITE (no schema change)

The confirm transaction issues:

```sql
UPDATE refresh_tokens
SET is_revoked = true
WHERE user_id = $user_id AND is_revoked = false;
```

Then inserts one new row for the freshly issued session. No structural change.

### 4. `audit_events` — APPENDED (no schema change)

Two new `action` values added to the existing string column (no enum migration needed since `action` is `varchar(50)`):

| `action` | `actor_id` | `target_type` | `target_id` | `old_values` | `new_values` | Tenant context |
|---|---|---|---|---|---|---|
| `password_reset_requested` | `user.id` | `"user"` | `user.id` | NULL | NULL | `tenant_id = user.tenant_id` |
| `password_reset_completed` | `user.id` | `"user"` | `user.id` | NULL | NULL | `tenant_id = user.tenant_id` |

The append happens **only when the email resolves to a real active user** (FR-011 — the audit table itself must not be an enumeration oracle).

## Migration files

### `packages/db/drizzle/0006_password_reset.sql`

```sql
-- 1. Promote users.email to a globally unique constraint.
--    BEFORE applying: run the audit query in research.md Decision 5.
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
```

### `packages/db/drizzle/0007_password_reset_no_rls.sql`

```sql
-- password_reset_tokens is intentionally NOT RLS-scoped.
-- Rationale: pre-authentication artifact; no tenant context exists at issuance.
-- Ownership enforced by user_id FK; isolation provided by the fact that the
-- public endpoints expose no tenant signal (see spec FR-001, FR-002, FR-015).
--
-- This file exists to keep the manual GRANT/REVOKE pattern consistent with
-- 0001_rls_policies.sql, 0002_rls_clients.sql, 0005_candidates_rls.sql.

-- Allow app_worker to read/write/delete on password_reset_tokens.
-- DELETE is needed for the daily cleanup cron (FR-017).
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO app_worker;
```

## State diagram — token lifecycle

```text
                   POST /request
                  (rate-limit OK,
                   user is active)
                         │
                         ▼
   ┌─────────────────────────────────────────┐
   │ INSERT row (used_at=NULL,               │
   │ expires_at=now()+30min)                 │
   │ + UPDATE older rows for same user_id    │
   │   SET used_at=now() WHERE used_at IS    │
   │   NULL AND expires_at > now()           │
   └────────────────────────┬────────────────┘
                            │
                            ▼
                     ┌─────────────┐
            ┌────────┤  PENDING    │────────┐
            │        └─────────────┘        │
            │                               │
   POST /confirm                  expires_at < now()
   (token valid)                  (no transition needed —
            │                      next read just fails;
            ▼                      cleanup cron deletes)
     ┌─────────────┐                       │
     │  CONSUMED   │ used_at = now()       │
     └──────┬──────┘                       │
            │                              │
            └──────────────┬───────────────┘
                           ▼
                  ┌─────────────────┐
                  │ Daily cron      │
                  │ DELETE WHERE    │
                  │ used_at NOT NULL│
                  │ OR expires_at   │
                  │ < now()         │
                  └─────────────────┘
```

## Drizzle schema (TypeScript)

```ts
// packages/db/src/schema/password-reset-tokens.ts
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("password_reset_tokens_token_hash_idx").on(table.tokenHash),
    index("password_reset_tokens_user_id_idx").on(table.userId),
    index("password_reset_tokens_expires_at_idx").on(table.expiresAt),
  ],
);
```

## Updated `users` schema (after FR-015 migration)

```ts
// packages/db/src/schema/users.ts — only the table-extra block changes
(table) => [
  unique("users_email_uq").on(table.email),       // CHANGED: global unique on email
  index("users_tenant_id_idx").on(table.tenantId),
],
```

The `tenant_id` column itself is unchanged and still NOT NULL — every user still belongs to exactly one tenant. Only the *uniqueness shape* is widened from "unique within a tenant" to "unique across all tenants".
