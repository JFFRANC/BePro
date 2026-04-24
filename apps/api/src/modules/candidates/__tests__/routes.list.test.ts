import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  createCandidate: vi.fn(),
  probeDuplicates: vi.fn().mockResolvedValue([]),
  getActivePrivacyNotice: vi.fn(),
  listCandidates: vi.fn(),
  getCandidateById: vi.fn(),
  DuplicatesDetectedError: class extends Error {
    code = "duplicates_detected" as const;
  },
  PrivacyNoticeMismatchError: class extends Error {
    code = "privacy_notice_invalid" as const;
  },
  FormConfigValidationError: class extends Error {
    code = "form_config_invalid" as const;
  },
  ClientNotFoundError: class extends Error {
    code = "client_not_found" as const;
  },
}));

vi.mock("../../../lib/db.js", () => ({ getDb: vi.fn() }));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  candidates: { _: "candidates" },
  candidateDuplicateLinks: { _: "candidate_duplicate_links" },
  clients: { _: "clients" },
  clientAssignments: { _: "client_assignments" },
  privacyNotices: { _: "privacy_notices" },
  users: { _: "users" },
  auditEvents: { _: "audit_events" },
}));

import { listCandidates, getCandidateById } from "../service.js";
import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TENANT_A = "11111111-1111-4111-9111-111111111111";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-9bbb-bbbbbbbbbbbb";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
};

function createMockTenantDb(tenantId: string) {
  const chainable: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      { id: tenantId, name: "Test", slug: "test", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(chainable)),
  };
  return chainable;
}

async function createToken(role: string, tenantId: string, sub = "actor-1") {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub,
      email: `${role}@example.com`,
      role,
      tenantId,
      isFreelancer: false,
      mustChangePassword: false,
      iat: now,
      exp: now + 900,
    },
    JWT_SECRET,
  );
}

const sampleListItem = (id = "cand-1", clientId = "client-1") => ({
  id,
  first_name: "Juan",
  last_name: "Pérez",
  client: { id: clientId, name: "Cliente" },
  status: "registered",
  updated_at: "2026-04-21T12:00:00.000Z",
  registering_user: { id: "rec-1", display_name: "Recruiter Demo" },
  is_active: true,
});

describe("GET /api/candidates (US2)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(createMockTenantDb(TENANT_A) as any);

    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — returns paginated items", async () => {
    vi.mocked(listCandidates).mockResolvedValue({
      items: [sampleListItem("a"), sampleListItem("b")] as never,
      next_cursor: null,
    });

    const token = await createToken("manager", TENANT_A);
    const res = await app.request(
      "/api/candidates",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items).toHaveLength(2);
    expect(body.next_cursor).toBeNull();
  });

  it("200 — recruiter passes role to service for own-only scope (FR-020)", async () => {
    vi.mocked(listCandidates).mockResolvedValue({ items: [], next_cursor: null });
    const token = await createToken("recruiter", TENANT_A, "rec-99");
    await app.request(
      "/api/candidates",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(listCandidates).toHaveBeenCalledOnce();
    const call = vi.mocked(listCandidates).mock.calls[0];
    expect(call[1]).toMatchObject({
      tenantId: TENANT_A,
      actorId: "rec-99",
      role: "recruiter",
    });
  });

  it("422 — rechaza limit fuera de rango", async () => {
    const token = await createToken("manager", TENANT_A);
    const res = await app.request(
      "/api/candidates?limit=999",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /api/candidates/:id (US2)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(createMockTenantDb(TENANT_A) as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — devuelve detalle cuando está dentro del scope", async () => {
    vi.mocked(getCandidateById).mockResolvedValue({
      candidate: { id: "cand-1" } as never,
      privacy_notice: null,
      status_history: [],
      duplicate_links: { as_new: [], as_existing: [] },
    });
    const token = await createToken("manager", TENANT_A);
    const res = await app.request(
      "/api/candidates/cand-1",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it("404 — fuera de scope NUNCA devuelve 403 (no enumeration)", async () => {
    vi.mocked(getCandidateById).mockResolvedValue(null);
    const token = await createToken("recruiter", TENANT_A);
    const res = await app.request(
      "/api/candidates/cand-other",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});

describe("Cross-tenant isolation (SC-004)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("Tenant A actor never sees Tenant B candidate by id", async () => {
    // El middleware setea tenant=A; el servicio aplica WHERE tenant=A en la consulta.
    // Si pidiéramos un candidato que vive en Tenant B, getCandidateById debe devolver null.
    vi.mocked(getDb).mockReturnValue(createMockTenantDb(TENANT_A) as any);
    vi.mocked(getCandidateById).mockResolvedValue(null);

    const token = await createToken("admin", TENANT_A);
    const res = await app.request(
      "/api/candidates/some-id-from-tenant-b",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(404);

    const call = vi.mocked(getCandidateById).mock.calls[0];
    // El actor context que recibió el servicio debe ser el del tenant A.
    expect(call[1]).toMatchObject({ tenantId: TENANT_A });
    expect(call[1].tenantId).not.toBe(TENANT_B);
  });

  it("Tenant A list query is parameterized with TENANT_A as tenantId", async () => {
    vi.mocked(getDb).mockReturnValue(createMockTenantDb(TENANT_A) as any);
    vi.mocked(listCandidates).mockResolvedValue({ items: [], next_cursor: null });

    const token = await createToken("admin", TENANT_A);
    await app.request(
      "/api/candidates",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    const call = vi.mocked(listCandidates).mock.calls[0];
    expect(call[1].tenantId).toBe(TENANT_A);
    expect(call[1].tenantId).not.toBe(TENANT_B);
  });
});
