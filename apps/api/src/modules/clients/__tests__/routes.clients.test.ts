import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  createClient: vi.fn(),
  listClients: vi.fn(),
  getClientById: vi.fn(),
  updateClient: vi.fn(),
  verifyClientAccess: vi.fn(),
  verifyClientWriteAccess: vi.fn(),
  listContacts: vi.fn().mockResolvedValue([]),
  listPositions: vi.fn().mockResolvedValue([]),
  listAssignments: vi.fn().mockResolvedValue([]),
  createAssignment: vi.fn(),
  deleteAssignment: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  createPosition: vi.fn(),
  updatePosition: vi.fn(),
  deletePosition: vi.fn(),
  createDocumentRecord: vi.fn(),
  listDocuments: vi.fn().mockResolvedValue([]),
  getDocumentById: vi.fn(),
  deleteDocumentRecord: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({
  getDb: vi.fn(),
}));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  users: { _: "users_table" },
  clients: { _: "clients_table" },
  clientAssignments: { _: "client_assignments_table" },
  clientContacts: { _: "client_contacts_table" },
  clientPositions: { _: "client_positions_table" },
  clientDocuments: { _: "client_documents_table" },
  auditEvents: { _: "audit_events_table" },
}));

import {
  createClient,
  listClients,
  getClientById,
  updateClient,
  verifyClientAccess,
} from "../service.js";
import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
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
      { id: TENANT_ID, name: "Test", slug: "test", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(chainable)),
  };
  return chainable;
}

async function createToken(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: "admin-uuid-1",
      email: "admin@example.com",
      role: "admin",
      tenantId: TENANT_ID,
      isFreelancer: false,
      mustChangePassword: false,
      iat: now,
      exp: now + 900,
      ...overrides,
    },
    JWT_SECRET,
  );
}

const sampleClientDto = {
  id: "client-uuid-1",
  name: "Empresa ABC",
  email: "info@empresa.com",
  phone: "+52 55 1234 5678",
  address: "Av. Reforma 123",
  latitude: 19.4326077,
  longitude: -99.133208,
  isActive: true,
  formConfig: {
    showInterviewTime: false,
    showPosition: false,
    showMunicipality: false,
    showAge: false,
    showShift: false,
    showPlant: false,
    showInterviewPoint: false,
    showComments: false,
  },
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-15T00:00:00.000Z",
};

describe("Client Routes", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mockDb = createMockTenantDb();
    vi.mocked(getDb).mockReturnValue(mockDb as any);

    const { clientsRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/clients", clientsRoutes);
  });

  describe("POST /api/clients", () => {
    it("201 — crea un cliente con datos válidos (admin)", async () => {
      vi.mocked(createClient).mockResolvedValue(sampleClientDto as any);
      const token = await createToken();

      const res = await app.request("/api/clients", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Empresa ABC" }),
      }, TEST_ENV);

      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.data.name).toBe("Empresa ABC");
      expect(createClient).toHaveBeenCalled();
    });

    it("422 — rechaza body inválido (nombre vacío)", async () => {
      const token = await createToken();

      const res = await app.request("/api/clients", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "" }),
      }, TEST_ENV);

      expect(res.status).toBe(422);
    });

    it("403 — rechaza a usuarios no-admin", async () => {
      const token = await createToken({ role: "recruiter", sub: "recruiter-uuid" });

      const res = await app.request("/api/clients", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Empresa" }),
      }, TEST_ENV);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/clients", () => {
    it("200 — retorna lista paginada de clientes", async () => {
      vi.mocked(listClients).mockResolvedValue({
        data: [sampleClientDto as any],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      const token = await createToken();

      const res = await app.request("/api/clients?page=1&limit=10", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }, TEST_ENV);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.pagination.total).toBe(1);
    });

    it("200 — cualquier rol autenticado puede listar", async () => {
      vi.mocked(listClients).mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
      const token = await createToken({ role: "recruiter", sub: "recruiter-uuid" });

      const res = await app.request("/api/clients", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }, TEST_ENV);

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/clients/:id", () => {
    it("200 — retorna detalle de cliente con sub-recursos", async () => {
      vi.mocked(verifyClientAccess).mockResolvedValue(true);
      vi.mocked(getClientById).mockResolvedValue(sampleClientDto as any);
      const token = await createToken();

      const res = await app.request("/api/clients/client-uuid-1", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }, TEST_ENV);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.name).toBe("Empresa ABC");
      expect(body.data.contacts).toBeDefined();
      expect(body.data.positions).toBeDefined();
      expect(body.data.assignments).toBeDefined();
    });

    it("404 — cliente no existe", async () => {
      vi.mocked(verifyClientAccess).mockResolvedValue(true);
      vi.mocked(getClientById).mockResolvedValue(null);
      const token = await createToken();

      const res = await app.request("/api/clients/nonexistent", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }, TEST_ENV);

      expect(res.status).toBe(404);
    });

    it("403 — usuario sin acceso al cliente", async () => {
      vi.mocked(verifyClientAccess).mockResolvedValue(false);
      const token = await createToken({ role: "recruiter", sub: "recruiter-uuid" });

      const res = await app.request("/api/clients/client-uuid-1", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }, TEST_ENV);

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/clients/:id", () => {
    it("200 — actualiza cliente (admin)", async () => {
      vi.mocked(updateClient).mockResolvedValue({ ...sampleClientDto, name: "Nuevo Nombre" } as any);
      const token = await createToken();

      const res = await app.request("/api/clients/client-uuid-1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Nuevo Nombre" }),
      }, TEST_ENV);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.name).toBe("Nuevo Nombre");
    });

    it("403 — rechaza a no-admin", async () => {
      const token = await createToken({ role: "manager", sub: "manager-uuid" });

      const res = await app.request("/api/clients/client-uuid-1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Nuevo Nombre" }),
      }, TEST_ENV);

      expect(res.status).toBe(403);
    });

    it("404 — cliente no existe", async () => {
      vi.mocked(updateClient).mockResolvedValue(null);
      const token = await createToken();

      const res = await app.request("/api/clients/nonexistent", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Nuevo" }),
      }, TEST_ENV);

      expect(res.status).toBe(404);
    });
  });
});
