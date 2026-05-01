# BePro API — Cloudflare Workers + Hono

## Stack
- **Runtime:** Cloudflare Workers
- **Framework:** Hono v4
- **Config:** `wrangler.jsonc`
- **Test:** Vitest

## Module Structure
Each domain module lives in `src/modules/{name}/`:
```
src/modules/auth/
├── routes.ts    # Hono sub-app with endpoints
├── service.ts   # Business logic
├── types.ts     # Module-specific types
└── schema.ts    # Drizzle table (if applicable)
```

## Patterns

### Adding a Module
1. Create module directory in `src/modules/{name}/`
2. Export a Hono sub-app from `routes.ts`
3. Mount in `src/index.ts`: `app.route("/api/{name}", moduleRoutes)`
4. No other module should need changes

### Environment Bindings
Access via Hono context:
```typescript
app.get("/example", (c) => {
  const db = c.env.DATABASE_URL;
});
```

Type bindings in `src/types.ts` — extend `Bindings` interface for new env vars.

### Tenant Context
Every tenant-scoped request must:
1. Extract `tenant_id` from JWT claims (middleware)
2. Call `SET LOCAL app.tenant_id = $1` inside the transaction
3. RLS policies enforce isolation at the database level

### Error Handling
Use Hono's `HTTPException` for API errors:
```typescript
import { HTTPException } from "hono/http-exception";
throw new HTTPException(404, { message: "Not found" });
```

### Validation
Use Zod schemas from `@bepro/shared` with Hono's validator middleware:
```typescript
import { zValidator } from "@hono/zod-validator";
import { loginSchema } from "@bepro/shared";

app.post("/login", zValidator("json", loginSchema), (c) => { ... });
```

## Commands
- `pnpm dev` — Start Wrangler dev server (port 8787)
- `pnpm deploy` — Deploy to Cloudflare Workers
- `pnpm test` — Run Vitest (unit + mocked integration)
- `pnpm test:integration` — Run real-Neon integration tests (requires `DATABASE_URL_WORKER` in `.dev.vars`, see `vitest.integration.config.ts`)
- `pnpm test:integration -- --run-slow` — Opt-in flag para tests `@slow` (e.g. SC-004 archive a N=2000 rows, feature 011)
- `pnpm typecheck` — Type check

## Implemented Modules

| Module | Path | Summary |
|---|---|---|
| `auth` | `src/modules/auth/` | JWT login, refresh token rotation, role middleware, `SET LOCAL app.tenant_id` on every request |
| `tenants` | embedded in `auth` / `users` | Tenant provisioning + slug lookup (pre-login, RLS-exempt table) |
| `users` | `src/modules/users/` | User CRUD within tenant, role assignment, CSV import, password management. Feature 010: `POST /users` también escribe una fila a `client_assignments` (atómica) cuando el body trae `clientId` y el rol es `account_executive` o `recruiter`; admin/manager descartan `clientId` (no-op). Errores de cliente uniformes en 400 "cliente inactivo o inexistente". |
| `clients` | `src/modules/clients/` | Client CRUD, contacts, positions (perfil completo + documentos por puesto vía R2 binding `FILES`, partial unique index `(tenant_id, position_id, type) WHERE is_active=true`; legacy `client_documents` archivado en sitio en migración 0010, endpoints legacy responden HTTP 410 Gone), AE assignments, per-client `form_config` |
| `candidates` | `src/modules/candidates/` | Registration with duplicate warning + privacy acknowledgement, 14-state FSM with role gating, R2 attachments (server-proxied upload, see ADR-002), admin reactivation (FR-038a), rejection/decline categories, retention-review compliance surface (FR-003a), append-only audit writes |
| `password-reset` | `src/modules/password-reset/` | Self-service reset (feature 009): public `POST /api/auth/password-reset/{request,confirm}`, KV-backed per-email rate-limit (`PASSWORD_RESET_RATE`), enumeration-safe response shape, 30-min single-use tokens, refresh-token revoke + lockout-clear inside the confirm transaction, audit writes only on success branches. Daily cleanup cron lives in `src/scheduled.ts`. See ADR-009. |

Future modules (per roadmap): `placements`, `audit` (dedicated query/projection surface on top of existing `audit_events`).
