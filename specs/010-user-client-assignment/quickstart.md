# Quickstart — User Creation with Primary Client Assignment

This is the local-dev recipe to verify feature 010 end-to-end after `/speckit.implement`. Use it during code review and as the smoke check before merging.

## Prerequisites

- Worktree on branch `010-user-client-assignment`
- `.dev.vars` populated for `apps/api` (DATABASE_URL + DATABASE_URL_WORKER)
- `pnpm install` ran at repo root
- Local Neon dev branch is fresh-seeded (or you ran `pnpm --filter @bepro/db db:push`)

## 1. Run the test pyramid

```bash
# Shared schema unit (Zod refinement)
pnpm --filter @bepro/shared test

# API mocked unit (fast feedback)
pnpm --filter @bepro/api test

# API real-Neon integration (asserts RLS + atomic rollback)
pnpm --filter @bepro/api test:integration

# Web RTL
pnpm --filter @bepro/web test

# Web e2e (assumes API at :8787 and web at :5173 — see step 2)
pnpm --filter @bepro/web test:e2e -- users-create-with-client.spec.ts
```

All five MUST be green before claiming the feature done. (Constitution §V.)

## 2. Manual smoke test

Two terminals.

```bash
# T1 — API
pnpm --filter @bepro/api dev      # http://localhost:8787

# T2 — Web
pnpm --filter @bepro/web dev      # http://localhost:5173
```

### Happy path

1. Sign in as an admin (seed user `admin@bepro.mx`).
2. Navigate to **Usuarios** → click **Crear usuario**.
3. Fill the modal:
   - Nombre: `Ana`, Apellido: `López`, Email: `ana.lopez+010@bepro.mx`, Password: `Sup3rSecret!`.
   - Role: `recruiter`. ⇒ The **Cliente** select MUST appear and be required.
   - Pick any active client.
4. Submit ⇒ toast `Usuario creado exitosamente`. Modal closes. The user list shows Ana.
5. Open **Clientes** → pick the client you used → assignments tab. Ana appears as a current assignment.

### Hidden field for admin/manager

1. In the same modal, switch role to `admin`. ⇒ The **Cliente** field disappears, any prior selection is cleared.
2. Switch back to `recruiter` ⇒ field reappears empty (and validation requires it on submit).
3. Switch to `manager` ⇒ field disappears again.

### Inactive-client race (E-02)

1. Open the modal. Pick role `account_executive` and select an active client (do NOT submit).
2. In a second admin session (or Drizzle Studio), set that client's `is_active = false`.
3. Submit the form. The API returns 400 `"cliente inactivo o inexistente"`. ⇒ The dropdown auto-refreshes and no longer lists the deactivated client. All other entered values are preserved.
4. Pick a different active client → resubmit ⇒ user is created.

### Cross-tenant clientId rejection

```bash
# In T3, sign in as Tenant A's admin and grab the JWT.
# Get any active clientId from Tenant B's seed data (via DB tool).

curl -X POST http://localhost:8787/api/users \
  -H "Authorization: Bearer <tenantA_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "leak@bepro.mx",
    "password": "Sup3rSecret!",
    "firstName": "Leak",
    "lastName": "Attempt",
    "role": "recruiter",
    "isFreelancer": false,
    "clientId": "<tenantB_client_uuid>"
  }'
```

MUST return:

```json
{ "error": "cliente inactivo o inexistente" }
```

… NOT a 200. NOT a different message that would leak tenant B's existence.

### Audit verification

```bash
pnpm --filter @bepro/db db:query "
  SELECT new_values
  FROM audit_events
  WHERE action = 'user.created'
  ORDER BY created_at DESC
  LIMIT 5;
"
```

The newest row for Ana MUST contain `\"clientId\": \"<uuid>\"`. The newest row for any admin you created MUST NOT contain `clientId`.

## 3. Rollback proof

```bash
# Count users + assignments before
pnpm --filter @bepro/db db:query "SELECT count(*) FROM users WHERE email = 'rollback@bepro.mx';"
pnpm --filter @bepro/db db:query "SELECT count(*) FROM client_assignments WHERE user_id IN (SELECT id FROM users WHERE email = 'rollback@bepro.mx');"

# Submit a request with a bogus clientId
curl -X POST http://localhost:8787/api/users \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rollback@bepro.mx",
    "password": "Sup3rSecret!",
    "firstName": "Roll",
    "lastName": "Back",
    "role": "recruiter",
    "isFreelancer": false,
    "clientId": "00000000-0000-0000-0000-000000000000"
  }'

# Both counts MUST still be 0 — proves the user insert was rolled back.
```

## 4. Regression

Run `/speckit.tasks` and the resulting `tasks.md` will list the integration test against feature 008 (batch assignments) to make sure that flow stays untouched (Story 4 / FR-008). Run:

```bash
pnpm --filter @bepro/api test -- clients/__tests__/service.batch-assignments.test.ts
pnpm --filter @bepro/api test:integration -- clients/__tests__/routes.batch-assignments.integration.test.ts
```

Must remain green.

## Cleanup

```sql
DELETE FROM audit_events WHERE new_values->>'email' LIKE '%+010@bepro.mx';
DELETE FROM client_assignments WHERE user_id IN (
  SELECT id FROM users WHERE email LIKE '%+010@bepro.mx'
);
DELETE FROM users WHERE email LIKE '%+010@bepro.mx';
```
