# Data Model: Users Module (004)

**Date**: 2026-04-13
**Feature**: 004-users-module

## Schema Changes

### Modified Table: `users`

Two new columns added to the existing users table:

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `last_login_at` | `timestamp with time zone` | `null` | Yes | Updated by auth service on successful login |
| `must_change_password` | `boolean` | `true` | No | Set to true on creation and admin password reset. Cleared when user changes their own password. |

**Migration**: Drizzle auto-generate from schema change. Non-breaking: `last_login_at` is nullable, `must_change_password` defaults to `true` (existing users created via seed should be updated to `false` if they've already set passwords).

**Note on default**: `must_change_password` defaults to `true` because all new users created through the users module will need to change their password. For the existing seed admin user (created during auth module setup), the migration should explicitly set `must_change_password = false`.

### New Table: `audit_events`

Lightweight audit trail table — will be owned by the full audit module (007) later.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | `uuid` | `gen_random_uuid()` | No | Primary key |
| `tenant_id` | `uuid` | — | No | FK → tenants.id, RLS scoped |
| `actor_id` | `uuid` | — | No | User who performed the action |
| `action` | `varchar(50)` | — | No | Action type (see enum below) |
| `target_type` | `varchar(50)` | — | No | Entity type affected (e.g., "user") |
| `target_id` | `uuid` | — | No | ID of the affected entity |
| `old_values` | `jsonb` | `null` | Yes | Previous state (partial, relevant fields only) |
| `new_values` | `jsonb` | `null` | Yes | New state (partial, relevant fields only) |
| `created_at` | `timestamp with time zone` | `now()` | No | When the event occurred |

**Indexes**:
- `audit_events_tenant_id_idx` on `(tenant_id)` — RLS performance
- `audit_events_target_idx` on `(tenant_id, target_type, target_id)` — query by entity
- `audit_events_created_at_idx` on `(created_at)` — chronological queries

**RLS Policies**:
- `audit_events_tenant_select`: SELECT where `tenant_id = current_setting('app.tenant_id')::uuid`
- `audit_events_tenant_insert`: INSERT with CHECK `tenant_id = current_setting('app.tenant_id')::uuid`
- `audit_events_no_update`: UPDATE using `false` (append-only, never modify)
- `audit_events_no_delete`: DELETE using `false` (append-only, never delete)

**Constraints**:
- No UPDATE allowed (append-only per constitution)
- No DELETE allowed (immutable records)

### Action Types (for `action` column)

| Action | Description |
|--------|-------------|
| `user.created` | New user created (single or bulk import) |
| `user.updated` | User profile fields changed |
| `user.role_changed` | User role modified |
| `user.deactivated` | User soft-deleted |
| `user.reactivated` | User restored |
| `user.password_changed` | User changed their own password |
| `user.password_reset` | Admin reset user's password |
| `user.bulk_imported` | Batch of users imported via CSV |

### Existing Tables — No Changes

- **`tenants`**: No modifications needed.
- **`refresh_tokens`**: No schema changes. Bulk revocation uses existing `is_revoked` column via `UPDATE ... WHERE user_id = $1`.

## Entity Relationships

```text
tenants (1) ──── (N) users
                      │
users (1) ──── (N) refresh_tokens
                      │
users (1) ──── (N) audit_events (as actor)
users (1) ──── (N) audit_events (as target)
```

## Validation Rules (from spec FRs)

| Field | Rule |
|-------|------|
| `email` | Valid email format, unique per (tenant_id, email), immutable after creation |
| `password` | Min 8 chars, at least 1 uppercase, 1 lowercase, 1 number |
| `first_name` | Required, max 100 chars |
| `last_name` | Required, max 100 chars |
| `role` | Must be one of: admin, manager, account_executive, recruiter |
| `is_freelancer` | Boolean, only meaningful when role = recruiter |

## State Transitions

### User Active Status

```text
Created (is_active: true, must_change_password: true)
    │
    ├── Admin deactivates → Inactive (is_active: false)
    │                           │
    │                           └── Admin reactivates → Active (is_active: true)
    │
    └── User changes password → Active (must_change_password: false)
```

### Session Revocation Triggers

| Event | Sessions Affected |
|-------|-------------------|
| User deactivated | All sessions for that user revoked |
| Password changed (self) | All other sessions revoked (current session preserved) |
| Password reset (admin) | All sessions for that user revoked |
| User reactivated | No session changes (user must log in fresh) |
