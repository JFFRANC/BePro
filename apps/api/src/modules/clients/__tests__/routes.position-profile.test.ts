// 011-puestos-profile-docs / US1 — routes tests (mocked)
// Cubre POST 201 / PATCH 200 / 400 invalid_age_range / 403 recruiter / 409 duplicate.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sign } from "hono/jwt";

vi.mock("../service.js", async () => {
  const actual = await vi.importActual<typeof import("../service.js")>(
    "../service.js",
  );
  return {
    ...actual,
    createClient: vi.fn(),
    listClients: vi.fn(),
    getClientById: vi.fn(),
    updateClient: vi.fn(),
    verifyClientAccess: vi.fn().mockResolvedValue(true),
    verifyClientWriteAccess: vi.fn().mockResolvedValue(true),
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
    getPosition: vi.fn(),
    deletePosition: vi.fn(),
    createDocumentRecord: vi.fn(),
    listDocuments: vi.fn().mockResolvedValue([]),
    getDocumentById: vi.fn(),
    deleteDocumentRecord: vi.fn(),
  };
});

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
  clientPositionDocuments: { _: "client_position_documents_table" },
  auditEvents: { _: "audit_events_table" },
}));

import {
  createPosition,
  updatePosition,
  getPosition,
  verifyClientWriteAccess,
  InvalidAgeRangeError,
} from "../service.js";
import { getDb } from "../../../lib/db.js";
import { clientsRoutes } from "../routes.js";
import { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
};
const CLIENT_ID = "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6222";
const POSITION_ID = "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6333";

function createMockTenantDb() {
  const chainable: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      {
        id: TENANT_ID,
        name: "Test",
        slug: "test",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: any) => cb(chainable)),
  };
  return chainable;
}

async function token(role: "admin" | "manager" | "account_executive" | "recruiter" = "admin") {
  return await sign(
    {
      sub: "actor-uuid",
      email: "test@bepro.mx",
      role,
      tenantId: TENANT_ID,
      isFreelancer: false,
      mustChangePassword: false,
      exp: Math.floor(Date.now() / 1000) + 60 * 5,
    },
    JWT_SECRET,
    "HS256",
  );
}

function mountApp() {
  const app = new Hono<HonoEnv>();
  app.route("/api/clients", clientsRoutes);
  return app;
}

const samplePositionDto = {
  id: POSITION_ID,
  clientId: CLIENT_ID,
  name: "AYUDANTE GENERAL",
  isActive: true,
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z",
  vacancies: 80,
  ageMin: 18,
  ageMax: 48,
  documents: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  (getDb as any).mockReturnValue(createMockTenantDb());
  (verifyClientWriteAccess as any).mockResolvedValue(true);
});

describe("011 — POST /api/clients/:clientId/positions", () => {
  it("returns 201 with full DTO when AE creates with full profile", async () => {
    const app = mountApp();
    (createPosition as any).mockResolvedValue(samplePositionDto);
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await token("account_executive")}`,
        },
        body: JSON.stringify({
          name: "AYUDANTE GENERAL",
          vacancies: 80,
          ageMin: 18,
          ageMax: 48,
          gender: "indistinto",
          educationLevel: "primaria",
          salaryAmount: 1951.0,
          salaryCurrency: "MXN",
          paymentFrequency: "weekly",
          workDays: ["mon", "tue", "wed", "thu", "fri"],
          shift: "fixed",
          requiredDocuments: ["CURP"],
          faq: ["NO REINGRESOS"],
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.name).toBe("AYUDANTE GENERAL");
  });

  it("returns 400 invalid_age_range when service throws InvalidAgeRangeError", async () => {
    const app = mountApp();
    (createPosition as any).mockRejectedValue(new InvalidAgeRangeError());
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await token("admin")}`,
        },
        // Pasamos un name pero el service rechaza con la excepción de defensa en profundidad.
        body: JSON.stringify({ name: "X" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("invalid_age_range");
  });

  it("returns 422 from Zod when body has ageMin > ageMax (refinement)", async () => {
    // Zod-level validation rechaza con 422 (zValidator). El 400 invalid_age_range
    // queda reservado para la defensa en profundidad del service.
    const app = mountApp();
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await token("admin")}`,
        },
        body: JSON.stringify({ name: "X", ageMin: 50, ageMax: 30 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });

  it("returns 403 when recruiter tries to create", async () => {
    const app = mountApp();
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await token("recruiter")}`,
        },
        body: JSON.stringify({ name: "X" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 on duplicate name in client", async () => {
    const app = mountApp();
    (createPosition as any).mockRejectedValue(new Error("POSITION_DUPLICATE"));
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await token("admin")}`,
        },
        body: JSON.stringify({ name: "DUP" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(409);
  });
});

describe("011 — PATCH /api/clients/:clientId/positions/:posId", () => {
  it("returns 200 with diffed DTO", async () => {
    const app = mountApp();
    (updatePosition as any).mockResolvedValue({
      ...samplePositionDto,
      salaryAmount: 2050,
    });
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions/${POSITION_ID}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await token("admin")}`,
        },
        body: JSON.stringify({ salaryAmount: 2050 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.salaryAmount).toBe(2050);
  });

  it("returns 404 when service returns null", async () => {
    const app = mountApp();
    (updatePosition as any).mockResolvedValue(null);
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions/${POSITION_ID}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await token("admin")}`,
        },
        body: JSON.stringify({ vacancies: 5 }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});

describe("011 — GET /api/clients/:clientId/positions/:posId", () => {
  it("returns 200 with full DTO including documents map", async () => {
    const app = mountApp();
    (getPosition as any).mockResolvedValue({
      ...samplePositionDto,
      documents: { contract: { id: "doc-uuid" } },
    });
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions/${POSITION_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await token("recruiter")}`,
        },
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.documents.contract.id).toBe("doc-uuid");
  });

  it("returns 404 (uniform) when client access fails", async () => {
    const app = mountApp();
    const { verifyClientAccess } = await import("../service.js");
    (verifyClientAccess as any).mockResolvedValueOnce(false);
    const res = await app.request(
      `/api/clients/${CLIENT_ID}/positions/${POSITION_ID}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${await token("recruiter")}`,
        },
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});
