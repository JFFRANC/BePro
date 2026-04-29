# Quickstart: Password Reset (009)

This is the first-run developer guide for picking up feature 009. Read after `spec.md`, `plan.md`, and `research.md`. The goal is: in 15 minutes you can hit both endpoints locally and watch a real (or suppressed) email come out.

## Prerequisites

- You're on branch `009-password-reset`.
- `pnpm install` runs cleanly from the repo root.
- `apps/api/.dev.vars` exists with at least `DATABASE_URL` and `JWT_ACCESS_SECRET`.
- Neon dev database is reachable; `pnpm --filter @bepro/db db:studio` opens.

## 1. Apply the database changes

```bash
# Step 1 — sanity check: no email exists in more than one tenant
pnpm --filter @bepro/db db:query "SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1;"
# Expected output: 0 rows. If any row returns, STOP and reconcile with the team
# (see research.md Decision 5).

# Step 2 — apply the migration
pnpm --filter @bepro/db db:exec packages/db/drizzle/0006_password_reset.sql
pnpm --filter @bepro/db db:exec packages/db/drizzle/0007_password_reset_no_rls.sql

# Step 3 — verify
pnpm --filter @bepro/db db:query "SELECT conname FROM pg_constraint WHERE conrelid = 'users'::regclass;"
# Expected: users_email_uq present, users_tenant_email_uq absent.

pnpm --filter @bepro/db db:query "\d password_reset_tokens"
# Expected: table exists with the columns from data-model.md.
```

## 2. Configure local environment

Add to `apps/api/.dev.vars`:

```ini
# Optional in dev — leave RESEND_API_KEY unset to use the suppressed transport.
# When unset, the EmailService logs a structured `email.suppressed` event with
# the would-be reset URL so you can copy/paste it into the browser. This is the
# expected dev-loop behavior (FR-018).
# RESEND_API_KEY=re_xxx
# RESEND_FROM_DOMAIN=no-reply@bepro.example
APP_URL=http://localhost:5173
```

If you do want to send real emails locally:
1. Get a Resend test API key from https://resend.com.
2. Verify a sender domain (or use Resend's `onboarding@resend.dev` test sender).
3. Fill in `RESEND_API_KEY` and `RESEND_FROM_DOMAIN`.

KV binding for rate-limit (one-time setup):

```bash
# Create a KV namespace for local dev (Wrangler binds it automatically)
wrangler kv namespace create PASSWORD_RESET_RATE
# Wrangler prints the namespace id; paste it into apps/api/wrangler.jsonc
# under kv_namespaces (the binding name MUST be PASSWORD_RESET_RATE).
```

Cron Trigger (added to `apps/api/wrangler.jsonc` during implementation):

```jsonc
"triggers": {
  "crons": ["0 3 * * *"]
}
```

## 3. Start dev servers

```bash
# Terminal 1
pnpm --filter @bepro/api dev      # http://localhost:8787

# Terminal 2
pnpm --filter @bepro/web dev      # http://localhost:5173
```

## 4. Walk through the happy path

```bash
# Pick (or create) an active user and remember the email.
pnpm --filter @bepro/db db:query "SELECT email, is_active FROM users WHERE is_active = true LIMIT 1;"

# Request a reset
curl -i -X POST http://localhost:8787/api/auth/password-reset/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"<that email>"}'
# Expected: 200 { "message": "Si la cuenta existe..." }
```

If `RESEND_API_KEY` is unset, look at the Wrangler tail in Terminal 1 for the `email.suppressed` event — it logs the full reset URL. Copy the `token=...` query param.

```bash
# Confirm the reset
curl -i -X POST http://localhost:8787/api/auth/password-reset/confirm \
  -H 'Content-Type: application/json' \
  -d '{"token":"<paste token>","password":"NewPa55!word"}'
# Expected: 200 with { accessToken, expiresAt, user } and a Set-Cookie header.
```

## 5. Walk through the web flow

1. Open http://localhost:5173/login.
2. Click **¿Olvidaste tu contraseña?** → lands on `/forgot-password`.
3. Enter the email → confirmation copy appears.
4. Grab the URL from the suppressed log → open it in the same browser.
5. Enter a new password matching the strength rules → redirected to `/`.
6. Open another tab → confirm the user is logged in.

## 6. Negative paths to spot-check

| Scenario | How to provoke | Expected |
|---|---|---|
| Unknown email | Use a fake address in `request` | 200, no email sent (no log event), no audit row |
| Deactivated user | Set `is_active = false` then `request` | Same as unknown — 200, no audit row |
| Expired token | Wait 31 minutes (or override `expires_at` in the DB to `now() - interval '1 minute'`) and submit `confirm` | 400 `el enlace ha expirado, solicita uno nuevo` |
| Already-used token | Submit `confirm` once successfully, then again with the same token | Same 400 — no differentiation |
| Older token superseded | Call `request` twice in a row (wait 60 s for the rate-limit), use the **older** token | Same 400 |
| Rate-limit (1/min) | Call `request` twice in <60s for the same email | Both return 200; only one suppression log/email |
| Rate-limit (5/hour) | Call `request` 6 times in <1h for the same email | All return 200; only 5 suppression logs/emails |
| Compromised session | Log in on Browser A, run reset on Browser B, attempt `/api/auth/refresh` from A | A gets 401 |
| Locked-out user | Manually set `locked_until = now() + interval '10 minutes'`, run reset, then attempt login with the new password | Login succeeds immediately (lockout cleared by reset) |

## 7. Run the test suite

```bash
pnpm --filter @bepro/api test                # unit tests
pnpm --filter @bepro/api test:integration    # full lifecycle vs. real Neon
pnpm --filter @bepro/web test                # web component tests
```

A green run on all three is the bar before opening the PR.

## 8. Trigger the cleanup cron locally

```bash
# Wrangler can fire scheduled handlers manually:
curl "http://localhost:8787/__scheduled?cron=0+3+*+*+*"
# Then verify expired/used rows are gone:
pnpm --filter @bepro/db db:query "SELECT count(*) FROM password_reset_tokens WHERE used_at IS NOT NULL OR expires_at < now();"
# Expected: 0
```

## Common gotchas

- **You set `RESEND_API_KEY` in `.dev.vars` but emails aren't going out**: Verify the sender domain is verified in Resend, and that `RESEND_FROM_DOMAIN` matches an `Email` (not just a domain) Resend recognises.
- **Curl returns 200 but no log appears**: The user resolution returned no row — double-check the email matches an active user (`is_active = true`).
- **Confirm always returns 400**: Make sure you're using the `token` from the URL query string, not the `id` from the database row. The link contains the raw token; the table holds `SHA-256(token)`.
- **Rate-limit doesn't seem to fire**: Workers Wrangler dev uses a local KV simulator that resets between restarts. Restart Wrangler and try again from a clean slate.
