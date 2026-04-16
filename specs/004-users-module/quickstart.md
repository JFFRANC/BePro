# Quickstart: Users Module (004)

**Date**: 2026-04-13
**Feature**: 004-users-module

## Integration Scenarios

### Scenario 1: Admin Creates a User and They Log In

1. Admin is authenticated with JWT containing `role: "admin"`.
2. Admin calls `POST /api/users` with user data (email, password, firstName, lastName, role, isFreelancer).
3. API validates input (Zod), hashes password (bcrypt cost 12), inserts user with `mustChangePassword: true`, records audit event.
4. API returns 201 with new user data.
5. New user logs in via `POST /api/auth/login`.
6. Auth service sets `lastLoginAt` and returns JWT with `mustChangePassword: true`.
7. Frontend `RequireAuth` component checks `mustChangePassword` from JWT/auth store.
8. Frontend redirects to `/change-password` forced flow.
9. User changes password via `POST /api/users/:id/change-password` with currentPassword (admin-set) and newPassword.
10. API clears `mustChangePassword`, revokes other sessions, returns success.
11. Frontend refreshes auth state — user can now access the application.

### Scenario 2: Admin Bulk Imports Users from CSV

1. Admin prepares CSV file with header: `email,firstName,lastName,role,isFreelancer`.
2. Admin navigates to Users → Import and uploads the file.
3. Frontend sends `POST /api/users/import` as `multipart/form-data`.
4. API validates header row, checks row count (max 100).
5. API processes each row independently: validates fields, checks email uniqueness, hashes generated password, inserts user.
6. API returns results JSON with success/error per row + temporary passwords for successful rows.
7. Frontend displays results table. Admin clicks "Download CSV" to get a file with emails + temporary passwords.
8. Admin distributes temporary passwords to new users (out of band).
9. Each new user logs in → forced password change flow (same as Scenario 1, steps 6-11).

### Scenario 3: Admin Deactivates a User

1. Admin navigates to user detail page.
2. Admin clicks "Desactivar" button.
3. Frontend shows confirmation dialog: "¿Estás seguro de que deseas desactivar a [nombre]?"
4. Admin confirms.
5. Frontend calls `PATCH /api/users/:id/deactivate`.
6. API checks: not self, not last admin, sets `isActive: false`, revokes all refresh tokens, records audit event.
7. Deactivated user's next API call fails with 401 (JWT still valid until expiry, but refresh fails).
8. Deactivated user's refresh token call returns 401 → frontend redirects to login.
9. Login attempt with deactivated account returns 401.

### Scenario 4: User Changes Their Own Password

1. User navigates to their profile page.
2. User clicks "Cambiar contraseña".
3. Frontend shows form: current password, new password, confirm new password.
4. User submits. Frontend validates password strength (Zod) before sending.
5. Frontend calls `POST /api/users/:id/change-password` with currentPassword and newPassword.
6. API verifies current password (bcrypt compare), hashes new password, clears `mustChangePassword`, revokes other sessions.
7. Frontend shows success toast, refreshes auth state.

### Scenario 5: Admin Views and Filters User Directory

1. Admin navigates to `/users`.
2. Frontend calls `GET /api/users?page=1&limit=20&isActive=true`.
3. API runs paginated query within tenant (RLS-scoped), returns user list + pagination metadata.
4. Admin types "García" in search bar.
5. Frontend calls `GET /api/users?page=1&limit=20&isActive=true&search=García`.
6. API adds `ILIKE '%García%'` filter on firstName, lastName, email columns.
7. Admin selects role filter "recruiter".
8. Frontend calls `GET /api/users?page=1&limit=20&isActive=true&search=García&role=recruiter`.
9. Results update in real-time via TanStack Query cache invalidation.

## Key Integration Points

| Component | Touches | Nature of Change |
|-----------|---------|-----------------|
| Auth service (`login`) | `apps/api/src/modules/auth/service.ts` | Update `lastLoginAt` on successful login, add `mustChangePassword` to JWT payload |
| Auth types (`JwtPayload`) | `apps/api/src/modules/auth/types.ts` | Add `mustChangePassword` field |
| Shared types (`ICurrentUser`) | `packages/shared/src/types/auth.ts` | Add `mustChangePassword` field |
| Frontend auth store | `apps/web/src/store/auth-store.ts` | Handle `mustChangePassword` flag |
| Frontend RequireAuth | `apps/web/src/App.tsx` or route guard | Redirect to forced password change |
| API entry point | `apps/api/src/index.ts` | Mount `app.route("/api/users", usersRoutes)` |
| DB schema exports | `packages/db/src/schema/index.ts` | Export `auditEvents` |
| Shared exports | `packages/shared/src/index.ts` | Export user schemas |

## Prerequisites

- Auth module (002) fully operational
- Database accessible with RLS policies active
- `pnpm install` dependencies current
- Environment variables: `DATABASE_URL`, `JWT_ACCESS_SECRET`
