# Quickstart: JWT Authentication Module

**Feature**: 002-jwt-auth-module  
**Date**: 2026-04-01

## Prerequisites

- Node.js 22+
- pnpm 10+
- Neon PostgreSQL database (with DATABASE_URL)
- Cloudflare Workers account (for deployment)

## Environment Setup

Add these variables to `apps/api/wrangler.jsonc` (development) or Cloudflare dashboard (production):

| Variable           | Description                          | Example                          |
|--------------------|--------------------------------------|----------------------------------|
| DATABASE_URL       | Neon PostgreSQL connection string    | `postgresql://user:pass@host/db` |
| JWT_ACCESS_SECRET  | HS256 signing secret for access JWTs | 256-bit random string            |

Generate a secure secret:
```bash
openssl rand -base64 32
```

## Local Development

```bash
# Install dependencies
pnpm install

# Start API dev server (port 8787)
pnpm --filter api dev

# Start frontend dev server (port 5173, proxies /api to 8787)
pnpm --filter web dev

# Run all tests
pnpm test

# Type-check all packages
pnpm typecheck
```

## Database Setup

```bash
# Generate migration from Drizzle schema
pnpm --filter db db:generate

# Push schema to Neon database
pnpm --filter db db:push

# Open Drizzle Studio for data inspection
pnpm --filter db db:studio
```

## Key Files (after implementation)

```
packages/db/src/schema/
├── tenants.ts              # tenants table definition
├── users.ts                # users table + login attempt columns
└── refresh-tokens.ts       # refresh_tokens table

apps/api/src/modules/auth/
├── routes.ts               # POST /login, /refresh, /logout, GET /me
├── service.ts              # Business logic (login, refresh, logout, validate)
├── types.ts                # AuthPayload, JwtClaims, module-specific types
└── middleware.ts            # authMiddleware, tenantMiddleware, requireRole

packages/shared/src/
├── types/auth.ts           # Updated: IAuthResponse without refreshToken, with tenantSlug
└── schemas/auth.ts         # Updated: loginSchema with tenantSlug field
```

## Testing the Auth Flow

### 1. Login
```bash
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret","tenantSlug":"acme"}' \
  -c cookies.txt
```

### 2. Access a protected endpoint
```bash
# Use the accessToken from the login response
curl http://localhost:8787/api/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

### 3. Refresh the access token
```bash
curl -X POST http://localhost:8787/api/auth/refresh \
  -H "X-Requested-With: fetch" \
  -b cookies.txt -c cookies.txt
```

### 4. Logout
```bash
curl -X POST http://localhost:8787/api/auth/logout \
  -H "X-Requested-With: fetch" \
  -b cookies.txt
```

## Seed Data

The auth module requires at least one tenant and one user to be functional. A seed script should create:

1. A default tenant (e.g., slug: "bepro", name: "BePro Reclutamiento")
2. An admin user with a known password for development

Example seed (to be implemented in `scripts/seed.ts`):
```
Tenant: { slug: "bepro", name: "BePro Reclutamiento" }
Admin:  { email: "admin@bepro.mx", password: "admin123", role: "admin" }
```
