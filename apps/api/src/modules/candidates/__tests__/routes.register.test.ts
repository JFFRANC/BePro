import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  createCandidate: vi.fn(),
  probeDuplicates: vi.fn().mockResolvedValue([]),
  getActivePrivacyNotice: vi.fn(),
  DuplicatesDetectedError: class DuplicatesDetectedError extends Error {
    code = "duplicates_detected" as const;
    constructor(public readonly duplicates: unknown[]) {
      super("dup");
      this.name = "DuplicatesDetectedError";
    }
  },
  PrivacyNoticeMismatchError: class PrivacyNoticeMismatchError extends Error {
    code = "privacy_notice_invalid" as const;
    constructor() {
      super("notice");
      this.name = "PrivacyNoticeMismatchError";
    }
  },
  FormConfigValidationError: class FormConfigValidationError extends Error {
    code = "form_config_invalid" as const;
    constructor(public readonly issues: unknown[]) {
      super("form");
      this.name = "FormConfigValidationError";
    }
  },
  ClientNotFoundError: class ClientNotFoundError extends Error {
    code = "client_not_found" as const;
    constructor() {
      super("client");
      this.name = "ClientNotFoundError";
    }
  },
  // 012-client-detail-ux — fail-closed cuando un tenant tiene formConfig dañado.
  FormConfigTamperedError: class FormConfigTamperedError extends Error {
    code = "form_config_tampered" as const;
    constructor(
      public readonly tenantId: string,
      public readonly clientId: string,
      public readonly missingBaseKeys: string[],
    ) {
      super("tampered");
      this.name = "FormConfigTamperedError";
    }
  },
  // 012 / R-07 — positionId no pertenece al cliente.
  InvalidPositionError: class InvalidPositionError extends Error {
    code = "invalid_position" as const;
    constructor() {
      super("invalid_position");
      this.name = "InvalidPositionError";
    }
  },
}));

vi.mock("../../../lib/db.js", () => ({ getDb: vi.fn() }));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  candidates: { _: "candidates" },
  candidateDuplicateLinks: { _: "candidate_duplicate_links" },
  clients: { _: "clients" },
  privacyNotices: { _: "privacy_notices" },
  users: { _: "users" },
  auditEvents: { _: "audit_events" },
}));

import {
  createCandidate,
  probeDuplicates,
  getActivePrivacyNotice,
  DuplicatesDetectedError,
  PrivacyNoticeMismatchError,
  FormConfigValidationError,
  ClientNotFoundError,
} from "../service.js";
import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TENANT_ID = "11111111-1111-4111-9111-111111111111";
const CLIENT_ID = "22222222-2222-4222-9222-222222222222";
const NOTICE_ID = "44444444-4444-4444-9444-444444444444";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
};

function createMockTenantDb() {
  const chainable: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      { id: TENANT_ID, name: "Test", slug: "test", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(chainable)),
  };
  return chainable;
}

async function createToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: "recruiter-uuid-1",
      email: "rec@example.com",
      role: "recruiter",
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

const sampleCandidate = {
  id: "55555555-5555-5555-5555-555555555555",
  tenant_id: TENANT_ID,
  client_id: CLIENT_ID,
  registering_user_id: "recruiter-uuid-1",
  client: { id: CLIENT_ID, name: "Cliente" },
  registering_user: { id: "recruiter-uuid-1", display_name: "Recruiter Demo" },
  first_name: "Juan",
  last_name: "Pérez",
  phone: "+52 55 1234 5678",
  email: "juan.perez@example.com",
  current_position: null,
  source: "LinkedIn",
  status: "registered" as const,
  additional_fields: {},
  rejection_category_id: null,
  decline_category_id: null,
  privacy_notice_id: NOTICE_ID,
  privacy_notice_acknowledged_at: "2026-04-21T12:00:00.000Z",
  is_active: true,
  updated_at: "2026-04-21T12:00:00.000Z",
  created_at: "2026-04-21T12:00:00.000Z",
};

const validBody = {
  client_id: CLIENT_ID,
  first_name: "Juan",
  last_name: "Pérez",
  phone: "+52 55 1234 5678",
  email: "juan.perez@example.com",
  source: "LinkedIn",
  privacy_notice_id: NOTICE_ID,
  privacy_acknowledged: true,
  additional_fields: {},
};

describe("POST /api/candidates (US1)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(createMockTenantDb() as any);

    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("201 — registra un candidato (happy path, contracts §1)", async () => {
    vi.mocked(createCandidate).mockResolvedValue({ candidate: sampleCandidate as any });
    const token = await createToken();

    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.candidate.id).toBe("55555555-5555-5555-5555-555555555555");
    expect(body.candidate.status).toBe("registered");
    expect(createCandidate).toHaveBeenCalledOnce();
  });

  it("409 — devuelve duplicados detectados", async () => {
    vi.mocked(createCandidate).mockRejectedValue(
      new (DuplicatesDetectedError as any)([
        {
          id: "dup-1",
          first_name: "Juan",
          last_name: "Pérez",
          status: "interview_scheduled",
          created_at: "2026-03-01T00:00:00.000Z",
          registering_user: { id: "u-other", display_name: "Otro Recruiter" },
        },
      ]),
    );
    const token = await createToken();

    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.code).toBe("duplicates_detected");
    expect(body.duplicates).toHaveLength(1);
    expect(body.duplicates[0].id).toBe("dup-1");
  });

  it("422 — falla cuando privacy_acknowledged !== true (FR-013)", async () => {
    const token = await createToken();
    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, privacy_acknowledged: false }),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(422);
  });

  it("422 — privacy_notice_id no es la versión activa", async () => {
    vi.mocked(createCandidate).mockRejectedValue(new (PrivacyNoticeMismatchError as any)());
    const token = await createToken();
    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe("privacy_notice_invalid");
  });

  it("422 — additional_fields falla validación contra form_config (FR-012)", async () => {
    vi.mocked(createCandidate).mockRejectedValue(
      new (FormConfigValidationError as any)([{ path: ["desired_salary"], message: "Required" }]),
    );
    const token = await createToken();
    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.code).toBe("form_config_invalid");
  });

  it("404 — cliente no encontrado", async () => {
    vi.mocked(createCandidate).mockRejectedValue(new (ClientNotFoundError as any)());
    const token = await createToken();
    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it("401 — sin Authorization header", async () => {
    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(401);
  });

  // 008-ux-roles-refinements / US2 — recruiter-only candidate create gate.
  it.each([
    ["admin"],
    ["manager"],
    ["account_executive"],
  ])("403 — %s no puede crear candidatos (FR-CG-001)", async (role) => {
    const token = await createToken({ role });
    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("forbidden");
    expect(body.message).toMatch(/solo reclutadores/i);
  });

  it("201 — recruiter freelancer también puede crear (FR-CG-001)", async () => {
    vi.mocked(createCandidate).mockResolvedValue({ candidate: sampleCandidate as any });
    const token = await createToken({ role: "recruiter", isFreelancer: true });
    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
  });

  // 008-ux-roles-refinements / US7 — privacy_notice_id is optional.
  it("201 — recruiter POST without privacy_notice_id (FR-RP-002)", async () => {
    vi.mocked(createCandidate).mockResolvedValue({ candidate: sampleCandidate as any });
    const token = await createToken();
    const { privacy_notice_id: _omit, privacy_acknowledged: _omit2, ...bodyNoNotice } =
      validBody;
    void _omit;
    void _omit2;

    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyNoNotice),
      },
      TEST_ENV,
    );

    expect(res.status).toBe(201);
    expect(createCandidate).toHaveBeenCalledOnce();
  });
});

describe("GET /api/candidates/duplicates (US1)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(createMockTenantDb() as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — devuelve duplicados encontrados", async () => {
    vi.mocked(probeDuplicates).mockResolvedValue([
      {
        id: "dup-1",
        first_name: "Juan",
        last_name: "Pérez",
        status: "interview_scheduled" as const,
        created_at: "2026-03-01T00:00:00.000Z",
        registering_user: { id: "u-other", display_name: "Otro" },
      },
    ]);
    const token = await createToken();

    const res = await app.request(
      `/api/candidates/duplicates?client_id=${CLIENT_ID}&phone=%2B52%2055%201234%205678`,
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.duplicates).toHaveLength(1);
  });

  it("422 — query inválida (sin client_id)", async () => {
    const token = await createToken();
    const res = await app.request(
      `/api/candidates/duplicates?phone=5512345678`,
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});

describe("GET /api/candidates/privacy-notice/active (US1)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(createMockTenantDb() as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — devuelve aviso activo", async () => {
    vi.mocked(getActivePrivacyNotice).mockResolvedValue({
      id: NOTICE_ID,
      version: "2026-04",
      text_md: "# Aviso",
      effective_from: "2026-04-01T00:00:00.000Z",
    });
    const token = await createToken();

    const res = await app.request(
      "/api/candidates/privacy-notice/active",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.privacy_notice.id).toBe(NOTICE_ID);
    expect(body.privacy_notice.version).toBe("2026-04");
  });

  it("404 — sin aviso activo en el tenant", async () => {
    vi.mocked(getActivePrivacyNotice).mockResolvedValue(null);
    const token = await createToken();

    const res = await app.request(
      "/api/candidates/privacy-notice/active",
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      TEST_ENV,
    );

    expect(res.status).toBe(404);
  });
});
