# Research: JWT Authentication Module

**Feature**: 002-jwt-auth-module  
**Date**: 2026-04-01

## R-001: Password Hashing on Cloudflare Workers

**Decision**: Use `bcryptjs` (pure JavaScript implementation).

**Rationale**: `bcryptjs` is already in the project dependencies (listed in CLAUDE.md active technologies). It is a pure JS implementation that runs on Cloudflare Workers without native bindings. Cost factor 12 produces ~250ms hash time, acceptable for login latency.

**Alternatives considered**:
- `bcrypt` (native): Requires Node.js bindings, incompatible with Workers runtime.
- `argon2`: Requires WASM or native bindings, not available on Workers.
- Web Crypto API (PBKDF2): Available on Workers, but bcrypt is the constitution-mandated standard.

---

## R-002: JWT Signing and Verification on Workers

**Decision**: Use `hono/jwt` (`sign` and `verify` functions) with HS256 algorithm.

**Rationale**: `hono/jwt` is built into Hono, uses the Web Crypto API internally (native to Workers), and provides both signing and verification. HS256 (symmetric HMAC-SHA256) is simple and appropriate for a single-service architecture where the same Worker both signs and verifies tokens.

**Alternatives considered**:
- `jose` library: More feature-rich but adds a dependency; unnecessary for HS256 single-issuer use case.
- RS256 (asymmetric): Useful when third parties verify tokens; unnecessary overhead for single-service architecture.
- `@tsndr/cloudflare-worker-jwt`: Another Workers-compatible library, but Hono's built-in is preferred to avoid extra dependencies.

---

## R-003: Refresh Token Strategy — Opaque vs JWT

**Decision**: Use opaque refresh tokens (random UUID), NOT JWT.

**Rationale**: Refresh tokens are always validated via database lookup (to check revocation, rotation family, expiry). A JWT refresh token adds no value because:
1. The token is never decoded without a DB check (rotation tracking requires DB state).
2. Opaque tokens are shorter and simpler to generate.
3. Only the hash is stored in the database (not the raw token), so even a DB breach doesn't expose valid tokens.
4. Simpler key management — only one signing secret needed (for access tokens).

**Alternatives considered**:
- JWT refresh tokens: Would require a second secret and provide no benefit since DB lookup is always needed.
- Signed opaque tokens (HMAC): Adds complexity without benefit — the DB lookup already validates the token.

---

## R-004: Drizzle ORM Transactions with Neon HTTP Driver

**Decision**: Use `db.transaction()` with `drizzle-orm/neon-http` for tenant-scoped operations.

**Rationale**: The Neon HTTP driver supports transactions via batch mode — all SQL statements in a transaction are sent as a single HTTP request. This makes `SET LOCAL app.tenant_id = $1` effective within the transaction boundary. Pattern:

```typescript
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL app.tenant_id = ${tenantId}`);
  // All subsequent queries use RLS with the set tenant_id
  return await tx.select().from(users);
});
```

**Alternatives considered**:
- WebSocket driver (`@neondatabase/serverless` with `Pool`): Supports long-lived connections and traditional transactions, but adds connection management complexity and doesn't align with the stateless Workers model.
- Per-query `WHERE tenant_id = ?` without RLS: Violates the constitution (RLS is the safety net).

---

## R-005: Tenant Resolution at Login

**Decision**: Login request includes a `tenantSlug` field alongside email and password.

**Rationale**: The constitution defines `(tenant_id, email)` uniqueness — the same email can exist in multiple tenants. Therefore, the system needs a tenant identifier before it can look up a user. A `tenantSlug` (URL-friendly string, e.g., "acme-corp") in the login request is the simplest approach. The tenants table will include a `slug` column with a unique constraint.

**Future migration path**: Subdomain-based resolution (`acme.bepro.app`) can be added later by reading the `Host` header. The `tenantSlug` field can then be populated automatically by the frontend or extracted by middleware.

**Alternatives considered**:
- Subdomain routing: Cleaner UX but requires wildcard DNS configuration and frontend deployment changes. Deferred to a future enhancement.
- Email-first flow (lookup tenant from email, then ask user to pick): Better UX for multi-tenant users but adds an extra round trip and UI complexity. Out of scope for v1.
- Global email uniqueness: Contradicts the constitution's `(tenant_id, email)` constraint.

---

## R-006: CSRF Protection for Refresh Endpoint

**Decision**: Use `SameSite=Strict` cookie attribute plus a custom header check (`X-Requested-With: fetch`).

**Rationale**: The refresh token cookie has `Path=/api/auth`, meaning it's only sent to auth endpoints. These are all POST endpoints, never navigated to directly. `SameSite=Strict` prevents the cookie from being sent on any cross-origin request. As defense-in-depth, requiring a custom `X-Requested-With` header blocks HTML form submissions (which can't set custom headers). No CSRF token needed.

**Alternatives considered**:
- CSRF token pattern: Adds complexity (token generation, storage, validation) without meaningful additional protection when SameSite=Strict is enforced.
- SameSite=Lax: Less restrictive; would allow GET requests from cross-site navigation. Unnecessary since our auth endpoints are POST-only.
- Double-submit cookie: Adds another cookie and validation logic. Overkill with SameSite=Strict.

---

## R-007: Per-Account Brute-Force Tracking Storage

**Decision**: Store login attempt counters directly on the `users` table (`failed_login_count`, `first_failed_at`, `locked_until` columns).

**Rationale**: Per-account lockout only needs to track state for existing accounts. Non-existent accounts get a constant-time generic error but no lockout state. Storing on the users row avoids a separate table, reduces query complexity, and atomically updates with the user lookup.

**Alternatives considered**:
- Separate `login_attempts` table: More flexible (could track per-IP later) but adds a JOIN and table complexity for v1.
- Cloudflare KV: Low-latency but eventually consistent — a race condition could allow extra attempts. Not suitable for a security mechanism.
- Cloudflare Durable Objects: Would provide strong consistency but adds significant complexity and cost.

---

## R-008: Access Token Expiry Duration

**Decision**: 15 minutes.

**Rationale**: Shorter expiry reduces the window of exploitation if a token is compromised. Silent renewal (transparent to the user) makes the short expiry invisible during active use. 15 minutes is at the low end of the constitution's 15-60 minute range, prioritizing security over reducing renewal frequency. For an edge-deployed API, the renewal round trip is fast (~50ms).

**Alternatives considered**:
- 30 minutes: A middle-ground approach; reduces renewal frequency but increases the risk window.
- 60 minutes: Maximum allowed by the constitution. Less secure; only justified if renewal creates measurable performance issues (unlikely on the edge).

---

## R-009: Cookie Configuration for Refresh Token

**Decision**: `refresh_token` cookie with the following attributes:
- `Secure`: Only sent over HTTPS
- `HttpOnly`: Not accessible via JavaScript
- `SameSite=Strict`: Not sent on cross-origin requests
- `Path=/api/auth`: Only sent to auth endpoints (login, refresh, logout)
- `Max-Age=604800`: 7 days (matches refresh token expiry)

**Rationale**: This configuration provides maximum protection:
- `HttpOnly` eliminates XSS exposure of the refresh token.
- `SameSite=Strict` eliminates CSRF on the refresh/logout endpoints.
- `Path=/api/auth` limits the cookie to auth-related endpoints only, reducing the attack surface.
- `Secure` ensures the token is never sent over unencrypted connections.

**Alternatives considered**:
- `Path=/`: Would send the cookie on every API request — unnecessary and increases exposure.
- `SameSite=Lax`: Would allow the cookie to be sent on top-level navigations from external sites — not needed for POST-only API endpoints.
