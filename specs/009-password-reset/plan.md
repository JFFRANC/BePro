# Implementation Plan: Password Reset (Self-Service)

**Branch**: `009-password-reset` | **Date**: 2026-04-28 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-password-reset/spec.md`

## Summary

Self-service password reset for active users via tokenized email link. The flow is initiated from a new "¿Olvidaste tu contraseña?" link on the login page, dispatches a Spanish-language email through Resend (called from the Worker via `fetch`), accepts a 32-byte URL-safe random token (stored as a SHA-256 hash, single-use, 30-min TTL), and on success sets a new bcrypt hash, revokes all refresh tokens for the user, clears any active brute-force lockout, issues a fresh session, and lands the user on `/`. The public request endpoint is enumeration-safe (always `200`, identical response shape) and rate-limited per email (1/min, 5/hour) via a Cloudflare KV counter. A daily Cron Trigger hard-deletes used or expired token rows. A prerequisite migration promotes `users.email` from `(tenant_id, email)` unique to a global unique so the email-only request endpoint can resolve a single user without tenant disambiguation.

Technical approach is captured in `./research.md`. Data model is in `./data-model.md`. API contracts are in `./contracts/`. The first-run developer guide is in `./quickstart.md`.

## Technical Context

**Language/Version**: TypeScript 5.8.3 (strict mode), shared across web / api / packages.
**Primary Dependencies**: Hono 4.x (Worker routing), Drizzle ORM 0.44 (schema + queries), `@neondatabase/serverless` 1.x via `drizzle-orm/neon-http`, bcryptjs 2.x (password hashing — already in repo), Zod 4.x (validation), Resend HTTP API (called via `fetch`, no SDK to keep the Worker bundle small), `hono/jwt` (already used by login), React 19 + Vite 6 + react-router-dom 7 + React Hook Form + Zod (web pages), TanStack Query 5 (mutations).
**Storage**: Neon PostgreSQL — new table `password_reset_tokens` (no RLS, mirrors `refresh_tokens` pattern), modified `users` (drop `users_tenant_email_uq`, add `users_email_uq`), append-only writes to `audit_events`. Cloudflare KV namespace `PASSWORD_RESET_RATE` for per-email rate-limit counters.
**Testing**: Vitest. Unit tests for the EmailService abstraction (assert "email.suppressed" structured log when key missing). Mocked-DB unit tests for the service layer. Real-Neon integration tests under `pnpm test:integration` for the full lifecycle (token issuance → expiry → single-use → refresh-token revocation → lockout clear → audit rows). Playwright smoke for the web flow if/when the project gains an e2e harness; otherwise component tests for the two pages and login link.
**Target Platform**: Cloudflare Workers (API), Cloudflare Pages (web SPA), Neon US-East (DB).
**Project Type**: Multi-package monorepo (`apps/web`, `apps/api`, `packages/shared`, `packages/db`).
**Performance Goals**: Inherits Worker baselines — request endpoint p95 < 250 ms (cold) including KV roundtrip + Neon HTTP roundtrip + Resend `fetch`. Confirm endpoint p95 < 400 ms including bcrypt cost-12 hash (~150–250 ms on Workers' WASM bcryptjs).
**Constraints**: §II Edge-First (no traditional servers — Resend is consumed via HTTP). §VI Security (bcrypt ≥ 12, hashed token storage, constant-time compare, no PII in logs, 30-min TTL). LFPDPPP — email body contains only the user's name, reset link, and Spanish copy; no password / hash / sensitive fields. KV write quota easily covered (~1 write per accepted request, free tier).
**Scale/Scope**: BePro is small — at peak we expect tens of reset requests per day across the platform, never thousands. KV's rate-limit footprint is one key per email per active hour. Token table is bounded by `pending_resets × 30min/24h` plus the cleanup grace window — typically <100 rows.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| **§I Multi-Tenant Isolation** | Pre-auth public endpoints expose no tenant signal. `password_reset_tokens` mirrors `refresh_tokens` (no RLS, ownership via `user_id` FK). Audit writes use the resolved user's `tenant_id`. The `users.email` global-unique migration *changes* the security & compliance row that documents `(tenant_id, email)` but does **not** weaken tenant isolation: each user still belongs to exactly one tenant; only the cross-tenant duplicate is forbidden. | ✅ PASS — see Complexity Tracking note |
| **§II Edge-First** | Resend is called from the Worker via `fetch`. KV for rate-limit. Cloudflare Cron Trigger for cleanup. No new long-running services. | ✅ PASS |
| **§III TypeScript Everywhere** | Zod schemas for request/confirm payloads live in `packages/shared`; both web and api consume them. Strict mode preserved. | ✅ PASS |
| **§IV Modular by Domain** | New module `apps/api/src/modules/password-reset/`. Adding it does not require modifying any existing module's public surface. (The `users` schema migration is a shared-package change, not a module dependency edit.) | ✅ PASS |
| **§V Test-First** | RED → GREEN → REFACTOR per task. Integration tests stub Resend and assert the full token lifecycle, no-enumeration timing parity, refresh-token revocation, and lockout clear. | ✅ PASS |
| **§VI Security by Design** | bcrypt cost ≥ 12 (already the project default); SHA-256 token hash via `crypto.subtle` (already used by `auth/service.ts:hashToken`); 32-byte URL-safe random via `crypto.getRandomValues`; constant-time compare via timing-safe equal helper; rate-limit per email; audit via `audit_events`; no PII in logs; LFPDPPP-safe email body. | ✅ PASS |
| **§VII Best Practices via Agents** | Task execution will dispatch `senior-backend-engineer`, `senior-frontend-engineer`, `db-architect`, `multi-tenancy-guardian`, plus the relevant skills (`jwt-security`, `owasp-security`, `hono`, `postgres-drizzle`, `react-vite-best-practices`, `zod`, `tanstack-query-best-practices`, `vitest`, `test-driven-development`, `verification-before-completion`). | ✅ PASS |
| **§VIII Spec-Driven Development** | Spec → Plan → Tasks → Implementation order respected. `/speckit.clarify` already ran (5 Q/A). | ✅ PASS |

Result: **All gates pass.** Single notable item is the `users` unique-constraint shape change — captured under Complexity Tracking below for visibility, not as a violation.

## Project Structure

### Documentation (this feature)

```text
specs/009-password-reset/
├── plan.md                        # this file
├── research.md                    # Phase 0 — decisions + rationale
├── data-model.md                  # Phase 1 — schema + migration
├── quickstart.md                  # Phase 1 — first-run dev guide
├── contracts/
│   └── password-reset.openapi.yaml  # Phase 1 — API contract
├── checklists/
│   └── requirements.md            # from /speckit.specify
├── spec.md                        # the spec
└── tasks.md                       # generated by /speckit.tasks (not by /speckit.plan)
```

### Source Code (repository root)

```text
packages/db/
├── src/schema/
│   ├── password-reset-tokens.ts        # NEW — token table definition
│   ├── users.ts                        # MODIFIED — drop tenant-email unique, add global email unique
│   └── index.ts                        # MODIFIED — re-export password-reset-tokens
└── drizzle/
    ├── 0006_password_reset.sql         # NEW — table create + unique swap (data audit done first; see research.md)
    └── 0007_password_reset_no_rls.sql  # NEW — explicit GRANT/REVOKE for app_worker on the new table

packages/shared/
└── src/schemas/
    └── password-reset.ts               # NEW — Zod schemas for request + confirm payloads

apps/api/
├── src/
│   ├── index.ts                        # MODIFIED — mount /api/auth/password-reset; add scheduled handler export
│   ├── scheduled.ts                    # NEW — Cron Trigger entry that calls password-reset cleanup
│   ├── types.ts                        # MODIFIED — add PASSWORD_RESET_RATE: KVNamespace, RESEND_API_KEY, RESEND_FROM_DOMAIN, APP_URL bindings
│   ├── lib/
│   │   ├── email-service.ts            # NEW — env-aware Resend transport with suppression fallback (FR-018)
│   │   └── rate-limit-kv.ts            # NEW — per-email KV-backed rate-limit (1/min, 5/hour) with namespacing
│   └── modules/
│       └── password-reset/
│           ├── routes.ts               # NEW — POST /request, POST /confirm
│           ├── service.ts              # NEW — issueToken, confirmToken, cleanup
│           ├── types.ts                # NEW — module-internal types
│           └── __tests__/
│               ├── service.unit.test.ts
│               ├── routes.integration.test.ts
│               ├── rate-limit.test.ts
│               └── email-service.test.ts
├── wrangler.jsonc                      # MODIFIED — add KV namespace binding, triggers.crons, RESEND_* secrets noted
└── .dev.vars.example                   # MODIFIED — document RESEND_API_KEY + APP_URL for local dev

apps/web/
└── src/
    ├── App.tsx                         # MODIFIED — add /forgot-password and /reset-password routes (public)
    └── modules/auth/
        ├── components/
        │   ├── LoginForm.tsx           # MODIFIED — add "¿Olvidaste tu contraseña?" link
        │   ├── ForgotPasswordForm.tsx  # NEW — email input + confirmation state
        │   └── ResetPasswordForm.tsx   # NEW — new password + confirm + strength feedback + invalid-link state
        ├── pages/
        │   ├── ForgotPasswordPage.tsx  # NEW
        │   └── ResetPasswordPage.tsx   # NEW
        ├── hooks/
        │   ├── usePasswordResetRequest.ts  # NEW — TanStack Query mutation
        │   └── usePasswordResetConfirm.ts  # NEW — TanStack Query mutation
        └── services/
            └── passwordResetService.ts # NEW — fetch wrappers
```

**Structure Decision**: This feature is a transverse change across all four packages. The bulk of the new code is contained in two new modules (`apps/api/src/modules/password-reset/` and the new web auth components/pages), plus one new schema file. The `users` schema change is a single-line constraint swap. Following §IV (Modular by Domain), no existing module's public surface changes — the auth module's `service.ts` is not edited; the lockout-clear logic for FR-016 lives inside the password-reset confirm transaction by directly setting the `failedLoginCount = 0`, `lockedUntil = NULL` columns on the `users` row, alongside the password hash update.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|--------------------------------------|
| Promote `users.email` from `(tenant_id, email)` unique to global `email` unique | FR-015 from spec — without it, an email-only request endpoint has ambiguous user resolution and the spec is unsound. Confirmed in `/speckit.clarify` Q1. | Keep tenant-scoped uniqueness and ask the user for `tenantSlug` on `/forgot-password`: rejected because (a) users may not remember their tenant, especially after `VITE_LOGIN_TENANT_FIXED` is removed, (b) the spec mandates email-only resolution. |
| Add a Cloudflare KV namespace just for rate-limit | FR-009 — per-email throttle (1/min, 5/hour). | A Postgres counter table: rejected because it adds row-level write contention on every request (defeats the rate-limit's purpose under abuse) and KV scales free-tier-comfortable for our scale. Reusing the auth module's lockout counter: rejected because the lockout counter is per-user-row and would conflate UX semantics. |
| Add a Cron Trigger handler (`scheduled.ts`) | FR-017 — daily cleanup of used/expired token rows. | Cleanup-on-write inside `confirmToken`: insufficient because expired-but-never-used rows would accumulate forever. A Postgres `pg_cron` schedule: not available on Neon. |
| Two migrations instead of one (`0006_password_reset.sql` + `0007_password_reset_no_rls.sql`) | Mirrors the existing convention (`0001_rls_policies.sql`, `0002_rls_clients.sql`, `0005_candidates_rls.sql` — RLS / GRANT logic is hand-rolled in a separate file from the schema generated by `drizzle-kit`). | Single migration: rejected to keep the diff narrow and the regenerated drizzle-kit output cleanly separated from the manual GRANT/REVOKE statements. |
| Export the previously-private `generateAccessToken` helper from `apps/api/src/modules/auth/service.ts` so the password-reset confirm endpoint can issue a session with the same shape as login (see ADR-009 §"Module boundaries"). | The §IV principle ("Adding a new module MUST NOT require modifying existing modules") is in soft tension here. Re-implementing JWT signing inside `password-reset` would duplicate ~30 lines and risk drift in the access-token claim shape. | Extracting the issuance into a shared `apps/api/src/lib/session-issuance.ts` consumed by both modules is the principled fix but adds a refactor across the auth module's tests; the documented one-line export is the cheaper option for the same observable outcome. Revisit if/when a third module needs the helper. |

## Deploy Discipline (single-merge gate)

CI auto-deploys on merge to `main` (`apps/api/CLAUDE.md` §"Commands"). To avoid shipping an unsafe partial reset endpoint to production, all phases of this feature MUST land on the `009-password-reset` feature branch and be merged to `main` **once**, after Phases 1–8 are green. Do not open intermediate PRs to `main` for incremental phases. (Intermediate merges to `development` or `testing` are fine.) If the team needs to demo the MVP after Phase 5, point the demo at the preview-branch deploy, not production.
