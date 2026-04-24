import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import type { HonoEnv } from "../../../types.js";

vi.mock("../service.js", () => ({
  createCandidate: vi.fn(),
  probeDuplicates: vi.fn().mockResolvedValue([]),
  getActivePrivacyNotice: vi.fn(),
  DuplicatesDetectedError: class extends Error {},
  PrivacyNoticeMismatchError: class extends Error {},
  FormConfigValidationError: class extends Error {},
  ClientNotFoundError: class extends Error {},
}));

vi.mock("../../../lib/db.js", () => ({ getDb: vi.fn() }));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  candidates: { _: "candidates" },
  clients: { _: "clients" },
  privacyNotices: { _: "privacy_notices" },
  users: { _: "users" },
  auditEvents: { _: "audit_events" },
  candidateDuplicateLinks: { _: "candidate_duplicate_links" },
}));

import { createCandidate } from "../service.js";
import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TENANT_ID = "11111111-1111-4111-9111-111111111111";
const CLIENT_ID = "22222222-2222-4222-9222-222222222222";
const NOTICE_ID = "44444444-4444-4444-9444-444444444444";

const PII_TOKENS = [
  "Juan",
  "Pérez",
  "+52 55 1234 5678",
  "5512345678",
  "juan.perez@example.com",
  "PERJ800101HDFXXX01",
  "PEPJ800101XXX",
];

const sampleCandidateDto = {
  id: "55555555-5555-4555-9555-555555555555",
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
  additional_fields: {
    curp: "PERJ800101HDFXXX01",
    rfc: "PEPJ800101XXX",
  },
  rejection_category_id: null,
  decline_category_id: null,
  privacy_notice_id: NOTICE_ID,
  privacy_notice_acknowledged_at: "2026-04-21T12:00:00.000Z",
  is_active: true,
  updated_at: "2026-04-21T12:00:00.000Z",
  created_at: "2026-04-21T12:00:00.000Z",
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

async function createToken() {
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
    },
    JWT_SECRET,
  );
}

describe("PII-free logs (SC-007 / FR-004)", () => {
  let app: Hono<HonoEnv>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(createMockTenantDb() as any);
    vi.mocked(createCandidate).mockResolvedValue({ candidate: sampleCandidateDto as any });

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("POST /api/candidates does not write any PII to console", async () => {
    const token = await createToken();
    const res = await app.request(
      "/api/candidates",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          first_name: "Juan",
          last_name: "Pérez",
          phone: "+52 55 1234 5678",
          email: "juan.perez@example.com",
          source: "LinkedIn",
          privacy_notice_id: NOTICE_ID,
          privacy_acknowledged: true,
          additional_fields: {
            curp: "PERJ800101HDFXXX01",
            rfc: "PEPJ800101XXX",
          },
        }),
      },
      { DATABASE_URL: "postgresql://test", JWT_ACCESS_SECRET: JWT_SECRET, ENVIRONMENT: "test" },
    );

    expect(res.status).toBe(201);

    const allCalls = [
      ...logSpy.mock.calls,
      ...errorSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...infoSpy.mock.calls,
    ];
    const captured = allCalls
      .map((args) =>
        args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" "),
      )
      .join("\n");

    for (const token of PII_TOKENS) {
      expect(captured, `PII token "${token}" leaked into logs`).not.toContain(token);
    }
  });
});
