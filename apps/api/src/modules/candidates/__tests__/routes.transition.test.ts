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
  CandidateNotFoundError: class extends Error {
    code = "candidate_not_found" as const;
  },
  StaleStatusError: class extends Error {
    code = "stale_status" as const;
    constructor(public readonly currentStatus: string) {
      super("stale");
    }
  },
  InvalidReactivationError: class extends Error {
    code = "invalid_reactivation" as const;
    constructor(message: string, public readonly status: 409 | 422) {
      super(message);
    }
  },
}));

vi.mock("../fsm.js", () => ({
  TransitionError: class extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly status: 403 | 422 = 422,
    ) {
      super(message);
    }
  },
  assertLegalTransition: vi.fn(),
  assertRoleAllowsTransition: vi.fn(),
}));

vi.mock("../../../lib/db.js", () => ({ getDb: vi.fn() }));

vi.mock("@bepro/db", () => ({
  tenants: { id: "id", isActive: "is_active" },
  candidates: { _: "candidates" },
  candidateDuplicateLinks: { _: "candidate_duplicate_links" },
  clients: { _: "clients" },
  clientAssignments: { _: "client_assignments" },
  privacyNotices: { _: "privacy_notices" },
  rejectionCategories: { _: "rejection_categories" },
  declineCategories: { _: "decline_categories" },
  users: { _: "users" },
  auditEvents: { _: "audit_events" },
}));

import {
  transitionCandidate,
  reactivateCandidate,
  CandidateNotFoundError,
  StaleStatusError,
  InvalidReactivationError,
} from "../service.js";
import { TransitionError } from "../fsm.js";
import { getDb } from "../../../lib/db.js";

const JWT_SECRET = "test-secret-key-256-bits-long!!";
const TENANT_A = "11111111-1111-4111-9111-111111111111";
const CAND_ID = "55555555-5555-4555-9555-555555555555";
const TEST_ENV = {
  DATABASE_URL: "postgresql://test",
  JWT_ACCESS_SECRET: JWT_SECRET,
  ENVIRONMENT: "test",
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

describe("POST /api/candidates/:id/transitions (US3)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockTenantDb() as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — happy path", async () => {
    vi.mocked(transitionCandidate).mockResolvedValue({
      candidate: { id: CAND_ID, status: "interview_scheduled" } as never,
      transition: {
        id: "audit-1",
        from_status: "registered",
        to_status: "interview_scheduled",
        actor_user_id: "actor-1",
        created_at: "2026-04-21T12:00:00.000Z",
      },
    });
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/transitions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from_status: "registered",
          to_status: "interview_scheduled",
        }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it("404 — out of scope", async () => {
    vi.mocked(transitionCandidate).mockRejectedValue(new (CandidateNotFoundError as any)());
    const t = await token("recruiter");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/transitions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from_status: "registered", to_status: "interview_scheduled" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it("409 — stale_status returns current_status", async () => {
    vi.mocked(transitionCandidate).mockRejectedValue(
      new (StaleStatusError as any)("attended"),
    );
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/transitions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from_status: "registered", to_status: "interview_scheduled" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.code).toBe("stale_status");
    expect(body.current_status).toBe("attended");
  });

  it("422 — illegal FSM edge", async () => {
    vi.mocked(transitionCandidate).mockRejectedValue(
      new (TransitionError as any)("nope", "fsm_illegal", 422),
    );
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/transitions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from_status: "attended", to_status: "hired" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });

  it("422 — missing rejection_category_id when to_status=rejected (Zod refine)", async () => {
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/transitions`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from_status: "approved", to_status: "rejected" }),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});

describe("POST /api/candidates/:id/reactivate (FR-038a)", () => {
  let app: Hono<HonoEnv>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockTenantDb() as any);
    const { candidatesRoutes } = await import("../routes.js");
    app = new Hono<HonoEnv>();
    app.route("/api/candidates", candidatesRoutes);
  });

  it("200 — admin reactivates from negative terminal", async () => {
    vi.mocked(reactivateCandidate).mockResolvedValue({
      candidate: { id: CAND_ID, is_active: true, status: "rejected" } as never,
      reactivation: {
        actor_user_id: "actor-1",
        created_at: "2026-04-21T12:00:00.000Z",
      },
    });
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/reactivate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(200);
  });

  it("404 — non-admin (masked)", async () => {
    vi.mocked(reactivateCandidate).mockRejectedValue(new (CandidateNotFoundError as any)());
    const t = await token("manager");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/reactivate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(404);
  });

  it("409 — not in a negative-terminal state", async () => {
    vi.mocked(reactivateCandidate).mockRejectedValue(
      new (InvalidReactivationError as any)("not terminal", 409),
    );
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/reactivate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(409);
  });

  it("422 — already active", async () => {
    vi.mocked(reactivateCandidate).mockRejectedValue(
      new (InvalidReactivationError as any)("already active", 422),
    );
    const t = await token("admin");
    const res = await app.request(
      `/api/candidates/${CAND_ID}/reactivate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      TEST_ENV,
    );
    expect(res.status).toBe(422);
  });
});
