import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  createUser: vi.fn(),
  listUsers: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  changePassword: vi.fn(),
  resetPassword: vi.fn(),
  deactivateUser: vi.fn(),
  reactivateUser: vi.fn(),
  bulkImportUsers: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn(),
}));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  users: { _: "users_table" },
  refreshTokens: { _: "refresh_tokens_table" },
  auditEvents: { _: "audit_events_table" },
}));

import {
  listUsers,
  getUserById,
  updateUser,
  changePassword,
  resetPassword,
  deactivateUser,
  reactivateUser,
  bulkImportUsers,
} from "../service.js";
import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
};

function createMockTenantDb() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      { id: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", name: "Test", slug: "test", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(chainable)),
  };
  return chainable;
}

async function createToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: "admin-uuid-1",
      email: "admin@test.com",
      role: "admin",
      tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
      isFreelancer: false,
      mustChangePassword: false,
      iat: now,
      exp: now + 900,
      ...overrides,
    },
    JWT_SECRET,
  );
}

function authHeaders(token: string) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

const mockUserDto = {
  id: "user-uuid-1",
  email: "user@test.com",
  firstName: "Juan",
  lastName: "Pérez",
  role: "recruiter" as const,
  isFreelancer: false,
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("Users routes", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(createMockTenantDb() as never);
    const { usersRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/users", usersRoutes);
  });

  // --- GET /api/users ---
  describe("GET /api/users", () => {
    it("returns 200 with paginated list", async () => {
      vi.mocked(listUsers).mockResolvedValue({
        data: [mockUserDto],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      const token = await createToken();
      const res = await app.request("/api/users", { headers: authHeaders(token) }, TEST_ENV);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/api/users", {}, TEST_ENV);
      expect(res.status).toBe(401);
    });
  });

  // --- GET /api/users/:id ---
  describe("GET /api/users/:id", () => {
    it("returns 200 when user found", async () => {
      vi.mocked(getUserById).mockResolvedValue(mockUserDto);
      const token = await createToken();
      const res = await app.request("/api/users/user-uuid-1", { headers: authHeaders(token) }, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it("returns 404 when user not found", async () => {
      vi.mocked(getUserById).mockResolvedValue(null);
      const token = await createToken();
      const res = await app.request("/api/users/nonexistent", { headers: authHeaders(token) }, TEST_ENV);
      expect(res.status).toBe(404);
    });
  });

  // --- PATCH /api/users/:id ---
  describe("PATCH /api/users/:id", () => {
    it("returns 200 on successful update", async () => {
      vi.mocked(updateUser).mockResolvedValue(mockUserDto);
      const token = await createToken();
      const res = await app.request("/api/users/user-uuid-1", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ firstName: "Carlos" }),
      }, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it("returns 403 when service returns error", async () => {
      vi.mocked(updateUser).mockResolvedValue({ error: "Forbidden" });
      const token = await createToken();
      const res = await app.request("/api/users/user-uuid-1", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ role: "admin" }),
      }, TEST_ENV);
      expect(res.status).toBe(403);
    });

    it("returns 404 when user not found", async () => {
      vi.mocked(updateUser).mockResolvedValue(null);
      const token = await createToken();
      const res = await app.request("/api/users/nonexistent", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ firstName: "Test" }),
      }, TEST_ENV);
      expect(res.status).toBe(404);
    });
  });

  // --- POST /api/users/:id/change-password ---
  describe("POST /api/users/:id/change-password", () => {
    it("returns 200 with new token on success", async () => {
      vi.mocked(changePassword).mockResolvedValue({ success: true, user: mockUserDto });
      const token = await createToken();
      const res = await app.request("/api/users/admin-uuid-1/change-password", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ currentPassword: "Old123456", newPassword: "New123456" }),
      }, TEST_ENV);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.accessToken).toBeDefined();
    });

    it("returns 400 on wrong password", async () => {
      vi.mocked(changePassword).mockResolvedValue({ error: "La contraseña actual es incorrecta" });
      const token = await createToken();
      const res = await app.request("/api/users/admin-uuid-1/change-password", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ currentPassword: "Wrong", newPassword: "New123456" }),
      }, TEST_ENV);
      expect(res.status).toBe(400);
    });

    it("returns 403 when changing another user password", async () => {
      const token = await createToken();
      const res = await app.request("/api/users/other-user-id/change-password", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ currentPassword: "Old123456", newPassword: "New123456" }),
      }, TEST_ENV);
      expect(res.status).toBe(403);
    });
  });

  // --- POST /api/users/:id/reset-password ---
  describe("POST /api/users/:id/reset-password", () => {
    it("returns 200 on success", async () => {
      vi.mocked(resetPassword).mockResolvedValue({ success: true });
      const token = await createToken();
      const res = await app.request("/api/users/user-uuid-1/reset-password", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ newPassword: "Temp123456" }),
      }, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it("returns 403 for non-admin", async () => {
      const token = await createToken({ role: "recruiter" });
      const res = await app.request("/api/users/user-uuid-1/reset-password", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ newPassword: "Temp123456" }),
      }, TEST_ENV);
      expect(res.status).toBe(403);
    });

    it("returns 404 when user not found", async () => {
      vi.mocked(resetPassword).mockResolvedValue(null);
      const token = await createToken();
      const res = await app.request("/api/users/nonexistent/reset-password", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ newPassword: "Temp123456" }),
      }, TEST_ENV);
      expect(res.status).toBe(404);
    });
  });

  // --- PATCH /api/users/:id/deactivate ---
  describe("PATCH /api/users/:id/deactivate", () => {
    it("returns 200 on success", async () => {
      vi.mocked(deactivateUser).mockResolvedValue({ ...mockUserDto, isActive: false });
      const token = await createToken();
      const res = await app.request("/api/users/user-uuid-1/deactivate", {
        method: "PATCH",
        headers: authHeaders(token),
      }, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it("returns 400 on self-deactivation", async () => {
      vi.mocked(deactivateUser).mockResolvedValue({ error: "No puedes desactivar tu propia cuenta" });
      const token = await createToken();
      const res = await app.request("/api/users/admin-uuid-1/deactivate", {
        method: "PATCH",
        headers: authHeaders(token),
      }, TEST_ENV);
      expect(res.status).toBe(400);
    });

    it("returns 403 for non-admin", async () => {
      const token = await createToken({ role: "recruiter" });
      const res = await app.request("/api/users/user-uuid-1/deactivate", {
        method: "PATCH",
        headers: authHeaders(token),
      }, TEST_ENV);
      expect(res.status).toBe(403);
    });
  });

  // --- PATCH /api/users/:id/reactivate ---
  describe("PATCH /api/users/:id/reactivate", () => {
    it("returns 200 on success", async () => {
      vi.mocked(reactivateUser).mockResolvedValue(mockUserDto);
      const token = await createToken();
      const res = await app.request("/api/users/user-uuid-1/reactivate", {
        method: "PATCH",
        headers: authHeaders(token),
      }, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it("returns 404 when user not found", async () => {
      vi.mocked(reactivateUser).mockResolvedValue(null);
      const token = await createToken();
      const res = await app.request("/api/users/nonexistent/reactivate", {
        method: "PATCH",
        headers: authHeaders(token),
      }, TEST_ENV);
      expect(res.status).toBe(404);
    });

    it("returns 403 for non-admin", async () => {
      const token = await createToken({ role: "recruiter" });
      const res = await app.request("/api/users/user-uuid-1/reactivate", {
        method: "PATCH",
        headers: authHeaders(token),
      }, TEST_ENV);
      expect(res.status).toBe(403);
    });
  });

  // --- POST /api/users/import ---
  describe("POST /api/users/import", () => {
    it("returns 200 with results on success", async () => {
      vi.mocked(bulkImportUsers).mockResolvedValue({
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        results: [{ row: 1, status: "success", email: "a@b.com", temporaryPassword: "Bp!abc" }],
      });
      const token = await createToken();
      const res = await app.request("/api/users/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: "email,firstName,lastName,role,isFreelancer\na@b.com,A,B,recruiter,false",
      }, TEST_ENV);
      expect(res.status).toBe(200);
    });

    it("returns 400 on invalid CSV", async () => {
      vi.mocked(bulkImportUsers).mockResolvedValue({ error: "El archivo CSV está vacío" });
      const token = await createToken();
      const res = await app.request("/api/users/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: "",
      }, TEST_ENV);
      expect(res.status).toBe(400);
    });

    it("returns 403 for non-admin", async () => {
      const token = await createToken({ role: "recruiter" });
      const res = await app.request("/api/users/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: "csv data",
      }, TEST_ENV);
      expect(res.status).toBe(403);
    });
  });
});
