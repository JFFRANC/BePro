# Research: Password Reset (009)

This document records the design decisions made during the planning of feature 009. Each section is one decision, the rationale, and the alternatives that were considered and rejected.

## Decision 1 — Email transport

**Decision**: Use Resend, called from the Worker via `fetch` (no SDK).

**Rationale**:
- §II Edge-First — Resend exposes a clean HTTP API (`POST https://api.resend.com/emails`) that works inside Workers without polyfills, with no TCP / Node-only dependencies.
- The Resend Node SDK is ~30 KB and pulls in a fetch wrapper layer the Worker doesn't need; calling `fetch` directly keeps the Worker bundle small and side-steps any future SDK breaking changes.
- Resend already integrates with Cloudflare for domain verification (CNAME records), which is the smoothest path for `RESEND_FROM_DOMAIN`.

**Alternatives considered**:
- **Postmark / SendGrid / SES**: All viable HTTP APIs; Resend chosen for the Cloudflare-first ergonomics, the simpler pricing, and matching Hector's existing tooling on other projects (recorded in `/Users/hectorfranco/.claude/projects/-Users-hectorfranco-Documents-BePro-repos-BePro/memory/project_stack_pivot.md`).
- **Workers `Email` workers binding**: Available but only for *receiving* email; outbound transactional needs a third-party.
- **Resend SDK**: Rejected as listed above.

## Decision 2 — Token format and storage

**Decision**: 32 bytes of cryptographically random data, encoded as URL-safe base64 (no padding) → 43 ASCII chars in the link. Stored only as `SHA-256(token)` (lowercase hex). Compared via constant-time equal.

**Rationale**:
- 32 bytes (256 bits) eliminates any guessing budget.
- URL-safe base64url avoids `+/=` characters that misbehave in some email clients and URL parsers; 43 chars is short enough to render cleanly in a single line of the email body.
- SHA-256 is sufficient for non-secret-derived hashing of a high-entropy random token (no need for bcrypt — bcrypt is for low-entropy human-typed passwords); also matches the existing `hashToken` pattern in `apps/api/src/modules/auth/service.ts:57-63`.
- Constant-time compare prevents timing oracles even though the lookup is by hash equality (defense in depth).

**Implementation note**: A single helper `generateResetToken(): { raw: string; hash: string }` is added to `apps/api/src/modules/password-reset/service.ts` so that the raw value never leaves the issuance call site.

**Alternatives considered**:
- **UUIDv4**: Only 122 bits of entropy and no canonical URL-safe encoding; rejected for the additional bits and uniformity.
- **bcrypt(token)**: Overkill — bcrypt's cost is meant to slow down dictionary attacks on low-entropy inputs; for a 32-byte random token, plain SHA-256 is faster and equally secure.
- **JWT-encoded token (self-validating)**: Rejected because we need server-side single-use enforcement, which JWTs cannot give us without a denylist (which is the same problem we're solving with the table).

## Decision 3 — Rate-limit storage

**Decision**: Cloudflare KV namespace `PASSWORD_RESET_RATE`. Keys are `pwreset:{sha256(email_lowercased)}:minute` and `pwreset:{sha256(email_lowercased)}:hour`, with `expirationTtl` set to 60 s and 3600 s respectively. Each accepted request increments the relevant counter (or sets it to 1 with the TTL).

**Rationale**:
- KV is a Workers-native primitive; no additional service.
- We hash the email so the KV value never contains PII in plaintext.
- TTL-based expiration means we never need a sweeper.
- The free tier covers our forecast easily (millions of writes/month at our scale of tens of resets/day).

**Alternatives considered**:
- **Cloudflare Durable Objects**: Stronger consistency, but overkill — defensive throttle tolerates KV's eventual consistency. DO would also cost more.
- **Postgres counter table**: Adds a write-hot row per active email; KV is the better fit.
- **Cloudflare Rate-Limiting Rules**: A WAF feature operating per source IP, not per email. Useless against an attacker who rotates IPs but probes the same email — the threat we're guarding against.

## Decision 4 — Cleanup strategy

**Decision**: Cloudflare Cron Trigger at `0 3 * * *` (03:00 UTC daily) calling a `scheduled` Worker handler that runs `DELETE FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at < now()`.

**Rationale**:
- §II Edge-First — Cron Triggers are Workers-native.
- Daily is more than frequent enough since the table never holds more than a small handful of valid rows at a time, and a missed run is self-correcting at the next tick.
- 03:00 UTC ≈ 21:00 / 22:00 Mexico City — well outside business hours.

**Alternatives considered**:
- **Inline cleanup on every request**: Adds latency to the hot path with no real benefit, since the token-hash lookup index already filters out expired rows.
- **No cleanup**: Table grows unbounded; rejected per §VI minimum-retention principle.
- **Hourly schedule**: Lower max stale-row count, but Workers Cron costs are negligible either way and daily is operationally simpler.

## Decision 5 — Email-uniqueness migration approach

**Decision**: Two-step migration in `0006_password_reset.sql`:
1. Audit query (run manually before applying): `SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;`. If any rows return, halt and resolve manually with the team.
2. Apply: `BEGIN; ALTER TABLE users DROP CONSTRAINT users_tenant_email_uq; ALTER TABLE users ADD CONSTRAINT users_email_uq UNIQUE (email); COMMIT;`

**Rationale**:
- The audit guards against silent data loss when applying the new unique would fail mid-deploy.
- Wrapping in a transaction means a failure leaves the table with the old constraint intact.
- BePro currently has 1 active tenant in production (per CLAUDE.md note about `VITE_LOGIN_TENANT_FIXED`), so cross-tenant collisions are extremely unlikely in practice — but the audit is a free safeguard.

**Alternatives considered**:
- **Keep both constraints**: Rejected — a global unique is strictly stronger than the composite, so the composite is redundant.
- **Add the global unique without dropping the composite**: Wastes index space and confuses future readers.
- **Offline migration with downtime**: Unnecessary at our scale; the constraint swap is fast (<1 ms on a small table).

## Decision 6 — Audit-event shape for password-reset events

**Decision**: Reuse the existing `audit_events` table. Two new event `action` values:

- `password_reset_requested` — `actor_id = user.id`, `tenant_id = user.tenant_id`, `target_type = "user"`, `target_id = user.id`, `old_values = null`, `new_values = null`.
- `password_reset_completed` — same shape.

**Rationale**:
- Re-use is cheaper than introducing a sibling table and matches the constitution's "every state change → audit row" pattern.
- Self-service flow → actor is the user. The schema requires non-null actor_id, and the user is the conceptually correct actor for their own reset.
- `old_values` / `new_values` are intentionally null because the only change is the password hash, which §VI forbids logging.

**Alternatives considered**:
- **Synthetic system actor for `actor_id`**: Rejected — would conflate self-service with admin-driven actions and require provisioning a fake user row.
- **New table `password_reset_audit`**: Rejected as gratuitous; `audit_events` already has the right indexes (`audit_events_target_idx` on `(tenant_id, target_type, target_id)`).

## Decision 7 — Hardening the request endpoint against timing-based enumeration

**Decision**: The request endpoint always:
1. Resolves the user (`SELECT … FROM users WHERE email = ?`).
2. If user is missing or inactive: still perform a no-op work-equivalent of the token-issuance path (a single `SHA-256` of a fixed dummy buffer + a no-op KV write to a discard key). Then return `200`.
3. If user is active: increment the KV counters; if within budget, generate the token, hash it, insert the row, dispatch the email (via the env-aware EmailService), then return `200`.

**Rationale**:
- The spec's User Story 2 (no enumeration) demands timing parity. The dominant variable cost in the success path is the token hashing + KV write; we mirror it on the miss path with cheap-but-non-zero work to keep latency bands overlapping.
- We do not perform a bcrypt comparison on the miss path (unlike `auth/service.ts` which uses a `DUMMY_HASH`) because bcrypt is not on the success path here either — the timing target is bytes, not bcrypt rounds.

**Alternatives considered**:
- **Random sleep**: Rejected — leaks information through the distribution shape and hurts user latency.
- **Always issue a "throwaway" token even on miss**: Closer to perfect parity but adds DB row-write load proportional to attack volume; rejected for cost.

## Decision 8 — Atomicity of confirm

**Decision**: The confirm endpoint runs everything inside one Drizzle `db.transaction(...)`:
1. Look up token by hash; verify `used_at IS NULL`, `expires_at > now()`.
2. Look up user by `token.user_id`; verify `is_active = true`.
3. Update `users` row in one statement: `password_hash = $newHash, failed_login_count = 0, first_failed_at = null, locked_until = null, must_change_password = false, updated_at = now()`.
4. Update `refresh_tokens` to set `is_revoked = true WHERE user_id = $user.id AND is_revoked = false`.
5. Mark the token used: `UPDATE password_reset_tokens SET used_at = now() WHERE id = $token.id`.
6. Insert the `password_reset_completed` audit row.
7. Issue a new access token + refresh token (these don't need to be inside the transaction, but it's cleaner to keep the refresh-token insert in scope).

**Rationale**:
- All-or-nothing semantics protect against the worst-case partial-success states (e.g., password updated but refresh tokens not revoked → attacker keeps their session).
- Single round trip to Neon via the HTTP driver's batch transaction support.

**Alternatives considered**:
- **Multiple round trips without a transaction**: Rejected for the partial-success risk above.
- **Optimistic locking on the token row**: Unnecessary — the `used_at IS NULL` check inside the transaction plus the `UPDATE … WHERE used_at IS NULL` semantics already prevent double-consumption (Postgres's row lock on the UPDATE serializes concurrent attempts).

## Decision 9 — EmailService shape

**Decision**: Single-method service:

```ts
interface EmailService {
  send(args: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void>;
}
```

Two implementations:
- `ResendEmailService` — calls `POST https://api.resend.com/emails` with `from = RESEND_FROM_DOMAIN`, `to`, `subject`, `html`, `text`.
- `SuppressedEmailService` — `console.log({ event: "email.suppressed", to, subject, urlPreview: extractFirstUrl(text) })`.

A factory function `getEmailService(env): EmailService` returns the suppressed implementation when `env.RESEND_API_KEY` is missing or empty, else returns the Resend implementation.

**Rationale**:
- Tests can inject `SuppressedEmailService` directly and assert the suppression event.
- Production failure of Resend (5xx) is caught and logged without leaking the recipient address (the message log is `{ event: "email.transport_failure" }` with the user_id only, never the email).
- The factory's branching is in one place — easy to verify by reading.

**Alternatives considered**:
- **Pass the email address through an audit event**: Rejected — violates §VI no-PII-in-logs.
- **Per-environment key with a sandbox sender**: Workable but requires per-env Resend domain configuration; the suppression model is simpler for a 2-dev team.

## Decision 10 — Web pages: validation timing and recovery affordance

**Decision**: As clarified in `/speckit.clarify` Q4 (recorded in `spec.md` Clarifications), the reset page validates only on submit. There is no `verify` endpoint. On a `400` from `confirm`, the page renders the inline expired/used message and a "Solicitar otro enlace" button that navigates to `/forgot-password` with the user's email pre-filled (read from URL state if it was passed, else empty).

**Rationale**:
- One fewer endpoint surface.
- Consistent behavior under attack — no probe oracle for token validity.
- The user's only friction is filling in a password before learning a stale link is stale, which the recovery button immediately resolves.

## Open items deliberately deferred to plan

None. All `[NEEDS CLARIFICATION]` markers from `/speckit.specify` were resolved either at spec time (informed defaults) or at `/speckit.clarify` time (5 Q/A).
