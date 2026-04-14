# Research: Users Module (004)

**Date**: 2026-04-13
**Feature**: 004-users-module

## Decision 1: Pagination Strategy

**Decision**: Offset-based pagination with `LIMIT` / `OFFSET` and `COUNT(*)` for total.

**Rationale**: The user directory is filtered, sorted, and searched — all operations where offset pagination is straightforward. Max 500 users per tenant makes cursor-based pagination unnecessary. Offset is simpler to implement, works well with Drizzle's `.limit()` and `.offset()`, and allows jumping to any page.

**Alternatives considered**:
- Cursor-based (keyset): Better for infinite scroll and large datasets, but overkill for 500-user max with page navigation. More complex to implement with multi-column sorts.

## Decision 2: CSV Parsing in Cloudflare Workers

**Decision**: Hand-roll a minimal CSV parser (~30 lines). No external library.

**Rationale**: The CSV format is simple and fixed (5 columns: email, firstName, lastName, role, isFreelancer). Max 100 rows. A small parser handles this without adding a dependency. Cloudflare Workers have limited bundle size budget, and CSV libraries (Papa Parse, etc.) are oversized for this use case. The CSV will be received as text from a `multipart/form-data` upload.

**Alternatives considered**:
- Papa Parse: Full-featured but ~15KB minified. Unnecessary for a fixed 5-column format.
- csv-parse/sync: Node.js native streams not available in Workers runtime.
- Native CSV from Hono: No built-in support.

## Decision 3: Temporary Password Generation for Bulk Import

**Decision**: Use `crypto.randomUUID()` truncated to first 12 characters as temporary password, prefixed with `Bp!` to satisfy strength requirements (uppercase + lowercase + number + special).

**Rationale**: `crypto.randomUUID()` is available in Cloudflare Workers runtime. Truncating to 12 chars + prefix gives a 15-char password that's strong enough and unique enough for temporary use. Users are forced to change on first login anyway.

**Format**: `Bp!` + first 12 chars of UUID = e.g., `Bp!a1b2c3d4-e5f` (15 chars, has uppercase B, lowercase letters, numbers, special !).

**Alternatives considered**:
- crypto.getRandomValues + custom alphabet: More control but more code for no meaningful benefit.
- Fixed temporary password: Security risk — all imported users would share the same initial password.

## Decision 4: Forced Password Change (mustChangePassword) Flow

**Decision**: Add `mustChangePassword` boolean column to users table (default: false). Check in **frontend** RequireAuth component — redirect to `/change-password` before allowing access to any other route. The API does NOT block requests from mustChangePassword users (other than login/change-password), because the JWT is valid regardless — the frontend enforces the redirect.

**Rationale**: Keeping the enforcement in the frontend is simpler and matches the existing pattern (RequireAuth already gates on isAuthenticated). API-level enforcement would require modifying every endpoint or adding a global middleware, which is over-engineering for an internal recruitment tool. The `mustChangePassword` flag is included in the JWT payload so the frontend can check it without an extra API call.

**Alternatives considered**:
- API middleware that blocks all endpoints except change-password: More secure but adds complexity to every request. Overkill for an internal tool with admin-set passwords.
- Separate "pending" user state: Over-engineers the user lifecycle. A boolean flag is sufficient.

## Decision 5: Audit Event Helper Design

**Decision**: Create a standalone `recordAuditEvent()` function in `apps/api/src/lib/audit.ts` that inserts into an `audit_events` table. Accepts: `db` (transaction), `tenantId`, `actorId`, `action` (string enum), `targetType` ("user"), `targetId`, `oldValues` (JSON), `newValues` (JSON).

**Rationale**: The full audit module (007) is not yet built. A simple insert function is sufficient for the users module. When module 007 is built, it will own the `audit_events` table and provide a richer API — the helper can be replaced by importing from the audit module. The table lives in `packages/db` so it's shared.

**Table**: `audit_events` with RLS policy (tenant-scoped), columns: id, tenantId, actorId, action, targetType, targetId, oldValues (jsonb), newValues (jsonb), createdAt.

**Alternatives considered**:
- Log-based audit (structured logs): Doesn't satisfy the constitution's "append-only AuditEvent table" requirement.
- Event sourcing: Massive over-engineering for the current scale.

## Decision 6: Search Implementation

**Decision**: Use PostgreSQL `ILIKE` with `%term%` pattern on `first_name`, `last_name`, and `email` columns combined with `OR`.

**Rationale**: With max 500 users per tenant and RLS already filtering by tenant, a simple ILIKE is fast enough. Full-text search (tsvector) is overkill. The search runs against the already-filtered tenant set, so performance is not a concern.

**Alternatives considered**:
- PostgreSQL full-text search (tsvector): Requires index setup, language configuration. Overkill for 500 users.
- Client-side filtering: Would require loading all users to the frontend. Not scalable even at 500.

## Decision 7: Role-Scoped User Visibility (MVP)

**Decision**: For MVP, implement three visibility tiers in the service layer (not RLS):
1. **Admin / Manager**: See all users in tenant (RLS handles tenant scoping).
2. **Account Executive**: See all users with role "recruiter" in tenant (simplified from "assigned recruiters" per spec assumption). Filter in service query.
3. **Recruiter**: See only their own user record. Filter by `id = currentUser.id` in service.

**Rationale**: The spec's Assumptions section explicitly states AE scoped visibility is simplified for MVP. Full assignment-based filtering requires the clients module (not yet built). The service-level filtering layer is easy to extend later when assignments exist.

**Alternatives considered**:
- RLS policy per role: Too complex for a temporary MVP behavior. Would need to be reworked when clients module adds assignments.

## Decision 8: Bulk Import Result Delivery

**Decision**: Return the import results (including temporary passwords) as a JSON response from the API. The frontend renders a downloadable results table with a "Download CSV" button that generates a client-side CSV of the results.

**Rationale**: Returning JSON keeps the API simple. The frontend can display results in a table and offer a CSV download. Temporary passwords are sensitive — displaying them once and offering a download is standard practice. The admin is responsible for securely distributing the passwords.

**Alternatives considered**:
- Return a CSV file from the API: Mixes response formats (JSON for errors, CSV for success). Harder to handle partial failures.
- Email passwords to users: Out of scope (no email service integration).
