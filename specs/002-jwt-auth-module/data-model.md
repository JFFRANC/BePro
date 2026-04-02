# Data Model: JWT Authentication Module

**Feature**: 002-jwt-auth-module  
**Date**: 2026-04-01

## Entity Relationship Overview

```
tenants 1───∞ users 1───∞ refresh_tokens
```

- A **Tenant** has many **Users**
- A **User** has many **Refresh Tokens** (one per active session)
- Refresh tokens are grouped by **family** for rotation tracking

## Tables

### tenants

The root entity for multi-tenant isolation. Not subject to RLS (queried before tenant context is established).

| Column       | Type         | Constraints                  | Description                          |
|--------------|--------------|------------------------------|--------------------------------------|
| id           | UUID         | PK, default gen_random_uuid  | Unique tenant identifier             |
| name         | VARCHAR(255) | NOT NULL                     | Display name of the organization     |
| slug         | VARCHAR(100) | NOT NULL, UNIQUE             | URL-friendly identifier (e.g., "acme-corp") used for login tenant resolution |
| is_active    | BOOLEAN      | NOT NULL, default TRUE       | Soft delete / deactivation flag      |
| created_at   | TIMESTAMPTZ  | NOT NULL, default now()      | Record creation timestamp            |
| updated_at   | TIMESTAMPTZ  | NOT NULL, default now()      | Last modification timestamp          |

**Indexes**:
- `tenants_slug_idx` on `slug` (covered by unique constraint)

**RLS**: None — this table is queried during authentication before tenant context exists.

---

### users

Represents authenticated platform users. Subject to RLS on `tenant_id`.

| Column              | Type         | Constraints                          | Description                            |
|---------------------|--------------|--------------------------------------|----------------------------------------|
| id                  | UUID         | PK, default gen_random_uuid          | Unique user identifier                 |
| tenant_id           | UUID         | NOT NULL, FK → tenants(id)           | Owning tenant                          |
| email               | VARCHAR(255) | NOT NULL                             | Login email address                    |
| password_hash       | VARCHAR(255) | NOT NULL                             | bcrypt hash (cost >= 12)               |
| first_name          | VARCHAR(100) | NOT NULL                             | User's first name                      |
| last_name           | VARCHAR(100) | NOT NULL                             | User's last name                       |
| role                | VARCHAR(30)  | NOT NULL                             | One of: admin, manager, account_executive, recruiter |
| is_freelancer       | BOOLEAN      | NOT NULL, default FALSE              | Payment tracking flag (recruiters only)|
| is_active           | BOOLEAN      | NOT NULL, default TRUE               | Soft delete / deactivation flag        |
| failed_login_count  | INTEGER      | NOT NULL, default 0                  | Brute-force counter (resets on success)|
| first_failed_at     | TIMESTAMPTZ  | NULL                                 | Start of current 15-min failure window |
| locked_until        | TIMESTAMPTZ  | NULL                                 | Account lockout expiry (null = not locked) |
| created_at          | TIMESTAMPTZ  | NOT NULL, default now()              | Record creation timestamp              |
| updated_at          | TIMESTAMPTZ  | NOT NULL, default now()              | Last modification timestamp            |

**Unique constraints**:
- `users_tenant_email_uq` on `(tenant_id, email)` — per constitution

**Indexes**:
- `users_tenant_id_idx` on `tenant_id` (for RLS filtering)
- `users_email_idx` on `email` (for login lookups — combined with tenant_id via the unique constraint)

**RLS Policy** (on `tenant_id`):
- `SELECT`: `tenant_id = current_setting('app.tenant_id')::uuid`
- `INSERT`: `tenant_id = current_setting('app.tenant_id')::uuid`
- `UPDATE`: `tenant_id = current_setting('app.tenant_id')::uuid`
- `DELETE`: Blocked (soft delete only)

**Note on login**: Login queries bypass RLS because they run before tenant context is set. The login service uses a non-RLS connection or a superuser role to look up the user by `(tenant_slug → tenant_id, email)`.

---

### refresh_tokens

Tracks active and rotated refresh tokens for session management and theft detection.

| Column       | Type         | Constraints                          | Description                             |
|--------------|--------------|--------------------------------------|-----------------------------------------|
| id           | UUID         | PK, default gen_random_uuid          | Unique token record identifier          |
| user_id      | UUID         | NOT NULL, FK → users(id)             | Owner of this refresh token             |
| token_hash   | VARCHAR(255) | NOT NULL                             | SHA-256 hash of the opaque token value  |
| family       | UUID         | NOT NULL                             | Groups tokens in a rotation chain       |
| is_revoked   | BOOLEAN      | NOT NULL, default FALSE              | TRUE if token has been used/rotated or explicitly revoked |
| expires_at   | TIMESTAMPTZ  | NOT NULL                             | Token expiry (7 days from creation)     |
| created_at   | TIMESTAMPTZ  | NOT NULL, default now()              | Record creation timestamp               |

**Indexes**:
- `refresh_tokens_token_hash_idx` on `token_hash` (for fast lookup during refresh)
- `refresh_tokens_user_family_idx` on `(user_id, family)` (for theft detection — find all tokens in a family)
- `refresh_tokens_expires_at_idx` on `expires_at` (for cleanup of expired tokens)

**RLS**: Not applied. Refresh tokens are always accessed by the auth service using the token hash from the cookie, not by tenant context. The `user_id` FK ensures ownership.

**Note**: This table does NOT have `tenant_id` because:
1. Refresh tokens are looked up by `token_hash`, not by tenant.
2. The associated `user_id` already belongs to a specific tenant.
3. Adding `tenant_id` would require RLS bypass during refresh (no tenant context available from an opaque cookie).

---

## State Transitions

### Refresh Token Lifecycle

```
                          ┌──────────┐
         Token created → │  Active   │
                          └────┬─────┘
                               │
                    ┌──────────┼──────────┐
                    │          │          │
                    ▼          ▼          ▼
              ┌──────────┐ ┌────────┐ ┌─────────┐
              │  Rotated  │ │Expired │ │ Revoked │
              │(new token │ │(7 days)│ │(logout) │
              │ issued)   │ │        │ │         │
              └──────────┘ └────────┘ └─────────┘
```

- **Active → Rotated**: On successful refresh. New token created in same family. Old token marked `is_revoked = true`.
- **Active → Expired**: Token reaches its `expires_at` timestamp. Becomes invalid on next use.
- **Active → Revoked**: On explicit logout. Token marked `is_revoked = true`.
- **Rotated token reuse detected**: All tokens in the family are revoked (theft detection per FR-006).

### Account Lockout Lifecycle

```
              ┌───────────┐
              │  Unlocked  │ ←─── successful login (reset counters)
              └─────┬──────┘
                    │ failed attempt
                    ▼
              ┌───────────┐
              │ Counting   │ (failed_login_count < 5, within 15-min window)
              │ Failures   │
              └─────┬──────┘
                    │ 5th failure
                    ▼
              ┌───────────┐
              │  Locked    │ (locked_until = now + 15 min)
              └─────┬──────┘
                    │ 15 minutes elapsed
                    ▼
              ┌───────────┐
              │  Unlocked  │ (counters reset)
              └────────────┘
```

---

## Validation Rules

| Entity        | Field         | Rule                                          |
|---------------|---------------|-----------------------------------------------|
| Tenant        | slug          | Lowercase alphanumeric + hyphens, 3-100 chars |
| Tenant        | name          | Non-empty, max 255 chars                      |
| User          | email         | Valid email format, max 255 chars              |
| User          | password_hash | bcrypt hash (60 chars)                        |
| User          | role          | One of: admin, manager, account_executive, recruiter |
| User          | is_freelancer | Only TRUE when role = recruiter               |
| Refresh Token | token_hash    | SHA-256 hex digest (64 chars)                 |
| Refresh Token | expires_at    | Must be > created_at                          |

---

## Cleanup Strategy

Expired and revoked refresh tokens accumulate over time. A periodic cleanup job should delete records where `expires_at < now() - interval '30 days'` OR `is_revoked = true AND created_at < now() - interval '30 days'`. This can be implemented as a Cloudflare Cron Trigger in a future iteration.
