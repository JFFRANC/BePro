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
- `pnpm test` — Run Vitest
- `pnpm typecheck` — Type check
