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
  transitionCandidate: vi.fn(),
  reactivateCandidate: vi.fn(),
  initAttachment: vi.fn(),
  uploadAttachment: vi.fn(),
  listAttachments: vi.fn(),
  getAttachmentDownload: vi.fn(),
  setAttachmentObsolete: vi.fn(),
  updateCandidatePii: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  getRetentionReviewStatus: vi.fn(),
  createRetentionReview: vi.fn(),
  DuplicatesDetectedError: class extends Error { code = "duplicates_detected" as const; },
  PrivacyNoticeMismatchError: class extends Error { code = "privacy_notice_invalid" as const; },
  FormConfigValidationError: class extends Error { code = "form_config_invalid" as const; },
  ClientNotFoundError: class extends Error { code = "client_not_found" as const; },
  CandidateNotFoundError: class extends Error { code = "candidate_not_found" as const; },
  StaleStatusError: class extends Error {
    code = "stale_status" as const;
    constructor(public readonly currentStatus: string) { super("stale"); }
  },
  InvalidReactivationError: class extends Error {
    code = "invalid_reactivation" as const;
    constructor(message: string, public readonly status: 409 | 422) { super(message); }
  },
  AttachmentNotFoundError: class extends Error { code = "attachment_not_found" as const; },
  AttachmentForbiddenError: class extends Error { code = "attachment_forbidden" as const; },
  CandidateEditForbiddenError: class extends Error { code = "edit_forbidden" as const; },
}));

vi.mock("../fsm.js", () => ({
  TransitionError: class extends Error {
    constructor(message: string, public readonly code: string, public readonly status: 403 | 422 = 422) {
      super(message);
    }
  },
}));

vi.mock("../../../lib/db.js", () => ({ getDb: vi.fn() }));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  candidates: { _: "candidates" },
  candidateAttachments: { _: "candidate_attachments" },
  candidateDuplicateLinks: { _: "candidate_duplicate_links" },
  clients: { _: "clients" },
  clientAssignments: { _: "client_assignments" },
  privacyNotices: { _: "privacy_notices" },
  rejectionCategories: { _: "rejection_categories" },
  declineCategories: { _: "decline_categories" },
  retentionReviews: { _: "retention_reviews" },
  users: { _: "users" },
  auditEvents: { _: "audit_events" },
}));

import {
  updateCandidatePii,
  initAttachment,
  listAttachments,
  setAttachmentObsolete,
  listCategories,
  createCategory,
  getRetentionReviewStatus,
  createRetentionReview,
  CandidateNotFoundError,
  CandidateEditForbiddenError,
} from "../service.js";
import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TENANT_A = "11111111-1111-4111-9111-111111111111";
const CAND_ID = "55555555-5555-4555-9555-555555555555";
const ATT_ID = "66666666-6666-4666-9666-666666666666";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
  FILES: {} as R2Bucket,
};

function mockTenantDb() {
  const c: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([
      { id: TENANT_A, name: "Test", slug: "test", isActive: true, createdAt: new Date(), updatedAt: new Date() },
    ]),
    execute: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>) => cb(c)),
  };
  return c;
}

async function token(role: string, sub = "actor-1") {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub,
      email: `${role}@example.com`,
      role,
      tenantId: TENANT_A,
      isFreelancer: false,
      mustChangePassword: false,
      iat: now,
      exp: now + 900,
    },
    JWT_SECRET,
  );
}

describe("PATCH /api/candidates/:id (US6)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockTenantDb() as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — admin updates PII", async () => {
    vi.mocked(updateCandidatePii).mockResolvedValue({ id: CAND_ID, first_name: "Juana" } as never);
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/${CAND_ID}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: "Juana" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it("404 — recruiter outside scope (masked)", async () => {
    vi.mocked(updateCandidatePii).mockRejectedValue(new (CandidateEditForbiddenError as any)());
    const t = await token("recruiter");
    const res = await app.request(
      `/api/candidates/${CAND_ID}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: "X" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it("404 — candidate not found", async () => {
    vi.mocked(updateCandidatePii).mockRejectedValue(new (CandidateNotFoundError as any)());
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/${CAND_ID}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ first_name: "X" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it("422 — empty body", async () => {
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/${CAND_ID}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});

describe("Attachments (US4)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockTenantDb() as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — list attachments returns mapped DTOs", async () => {
    vi.mocked(listAttachments).mockResolvedValue([
      {
        id: ATT_ID,
        candidateId: CAND_ID,
        tenantId: TENANT_A,
        uploaderUserId: "u",
        fileName: "cv.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        storageKey: "tenants/x/y",
        tag: "cv",
        isObsolete: false,
        isActive: true,
        uploadedAt: new Date("2026-04-21T12:00:00Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/attachments`,
      { method: "GET", headers: { Authorization: `Bearer ${t}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].file_name).toBe("cv.pdf");
  });

  it("200 — init attachment returns upload_url", async () => {
    vi.mocked(initAttachment).mockResolvedValue({
      attachment_id: ATT_ID,
      storage_key: "tenants/x/y",
      upload_url: `/api/candidates/${CAND_ID}/attachments/${ATT_ID}/upload`,
    });
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/attachments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: "cv.pdf",
          mime_type: "application/pdf",
          size_bytes: 1024,
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.attachment_id).toBe(ATT_ID);
  });

  it("422 — disallowed mime type", async () => {
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/attachments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: "evil.exe",
          mime_type: "application/octet-stream",
          size_bytes: 1024,
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });

  it("422 — > 10 MB rejected", async () => {
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/attachments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: "big.pdf",
          mime_type: "application/pdf",
          size_bytes: 11 * 1024 * 1024,
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });

  it("200 — mark obsolete", async () => {
    vi.mocked(setAttachmentObsolete).mockResolvedValue({
      id: ATT_ID,
      isObsolete: true,
      uploadedAt: new Date("2026-04-21T12:00:00Z"),
    } as never);
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/attachments/${ATT_ID}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_obsolete: true }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });
});

describe("Categories (US5)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockTenantDb() as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — list rejection categories (any role)", async () => {
    vi.mocked(listCategories).mockResolvedValue([
      { id: "c1", label: "Salary mismatch", is_active: true },
    ]);
    const t = await token("recruiter");
    const res = await app.request(
      `/api/candidates/categories/rejection`,
      { method: "GET", headers: { Authorization: `Bearer ${t}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.items).toHaveLength(1);
  });

  it("404 — non-admin cannot create (masked)", async () => {
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/categories/rejection`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ label: "New cat" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it("201 — admin creates category", async () => {
    vi.mocked(createCategory).mockResolvedValue({
      id: "c-new",
      label: "Cultural fit",
      is_active: true,
    });
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/categories/rejection`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Cultural fit" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
  });
});

describe("Retention reviews (FR-003a)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockTenantDb() as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — status with no prior reviews", async () => {
    vi.mocked(getRetentionReviewStatus).mockResolvedValue({
      next_due_at: "2027-04-21T00:00:00.000Z",
      days_remaining: 365,
      status: "ok",
      last_review: null,
    });
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/retention-reviews/status`,
      { method: "GET", headers: { Authorization: `Bearer ${t}` } },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it("201 — admin creates review", async () => {
    vi.mocked(createRetentionReview).mockResolvedValue({
      id: "rev-1",
      next_due_at: "2027-04-21T00:00:00.000Z",
    });
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/retention-reviews`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ justification_text: "Justificación anual" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(201);
  });

  it("404 — non-admin cannot create", async () => {
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/retention-reviews`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ justification_text: "X" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });
});
