import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  candidates: {
    _: "candidates",
    id: "id",
    tenantId: "tenant_id",
    clientId: "client_id",
    registeringUserId: "registering_user_id",
    isActive: "is_active",
    status: "status",
    updatedAt: "updated_at",
    firstName: "first_name",
    lastName: "last_name",
    email: "email",
    phoneNormalized: "phone_normalized",
    rejectionCategoryId: "rejection_category_id",
    declineCategoryId: "decline_category_id",
    privacyNoticeId: "privacy_notice_id",
  },
  candidateDuplicateLinks: {
    _: "candidate_duplicate_links",
    candidateId: "candidate_id",
    duplicateOfCandidateId: "duplicate_of_candidate_id",
    tenantId: "tenant_id",
  },
  clients: { _: "clients", id: "id", name: "name" },
  clientAssignments: {
    _: "client_assignments",
    clientId: "client_id",
    userId: "user_id",
  },
  privacyNotices: {
    _: "privacy_notices",
    id: "id",
    tenantId: "tenant_id",
    isActive: "is_active",
    effectiveFrom: "effective_from",
    version: "version",
  },
  users: {
    _: "users",
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
  },
  auditEvents: {
    _: "audit_events",
    tenantId: "tenant_id",
    targetType: "target_type",
    targetId: "target_id",
    createdAt: "created_at",
  },
}));

const TENANT_A = "11111111-1111-4111-9111-111111111111";

function listRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "cand-1",
    firstName: "Juan",
    lastName: "Pérez",
    clientId: "client-1",
    clientName: "Cliente Demo",
    status: "registered",
    updatedAt: new Date("2026-04-21T12:00:00Z"),
    registeringUserId: "rec-1",
    isActive: true,
    registeringFirstName: "Hector",
    registeringLastName: "Franco",
    ...overrides,
  };
}

// Mock chainable for listCandidates: select().from().innerJoin().innerJoin().where().orderBy().limit()
function buildSelectStub(rows: unknown[], assignmentRows: unknown[] = []) {
  // Tracker: next select call dispatches the appropriate builder.
  let selectIdx = 0;
  const builders = [
    // 1. assignment-lookup builder for AE role (used only when role=account_executive)
    {
      from: () => ({ where: () => Promise.resolve(assignmentRows) }),
    },
    // 2. main listing query
    {
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(rows),
              }),
            }),
          }),
        }),
      }),
    },
  ];

  const db: any = {
    select: vi.fn().mockImplementation(() => {
      const b = builders[selectIdx];
      selectIdx++;
      return b ?? builders[builders.length - 1];
    }),
  };
  return db;
}

describe("listCandidates (US2 — role-scoping)", () => {
  let listCandidates: typeof import("../service.js").listCandidates;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    listCandidates = mod.listCandidates;
  });

  it("recruiter — devuelve sólo candidatos donde registering_user_id = actor", async () => {
    const db = buildSelectStub([listRow({ id: "own-1" })]);
    // Para recruiter el primer select es directo el listado (no hay assignment lookup).
    db.select = vi
      .fn()
      .mockImplementationOnce(() => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve([listRow({ id: "own-1" })]),
                }),
              }),
            }),
          }),
        }),
      }));

    const res = await listCandidates(
      db,
      { tenantId: TENANT_A, actorId: "rec-1", role: "recruiter" },
      { include_inactive: false, limit: 25 } as never,
    );

    expect(res.items).toHaveLength(1);
    expect(res.items[0].id).toBe("own-1");
  });

  it("account_executive — usa client_assignments y forzar empty si no hay asignaciones", async () => {
    // Sin asignaciones: el role-scope debe forzar 0 resultados.
    const db = buildSelectStub([], []);

    const res = await listCandidates(
      db,
      { tenantId: TENANT_A, actorId: "ae-1", role: "account_executive" },
      { include_inactive: false, limit: 25 } as never,
    );
    expect(res.items).toHaveLength(0);
  });

  it("manager — sin filtro adicional, todos los candidatos del tenant", async () => {
    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () =>
                    Promise.resolve([
                      listRow({ id: "a" }),
                      listRow({ id: "b" }),
                      listRow({ id: "c" }),
                    ]),
                }),
              }),
            }),
          }),
        }),
      })),
    };

    const res = await listCandidates(
      db as any,
      { tenantId: TENANT_A, actorId: "mgr-1", role: "manager" },
      { include_inactive: false, limit: 25 } as never,
    );
    expect(res.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("admin — include_inactive=true sí incluye inactivos (FR-025)", async () => {
    let capturedConditions: unknown;
    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: (c: unknown) => {
                capturedConditions = c;
                return {
                  orderBy: () => ({
                    limit: () => Promise.resolve([listRow({ isActive: false })]),
                  }),
                };
              },
            }),
          }),
        }),
      })),
    };

    const res = await listCandidates(
      db as any,
      { tenantId: TENANT_A, actorId: "adm-1", role: "admin" },
      { include_inactive: true, limit: 25 } as never,
    );

    expect(res.items[0].is_active).toBe(false);
    expect(capturedConditions).toBeDefined();
  });

  it("paginación keyset — emite next_cursor cuando hay más resultados", async () => {
    const rows = Array.from({ length: 26 }, (_, i) =>
      listRow({ id: `c-${i}`, updatedAt: new Date(2026, 3, 21 - i) }),
    );
    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: () => ({
          innerJoin: () => ({
            innerJoin: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => Promise.resolve(rows),
                }),
              }),
            }),
          }),
        }),
      })),
    };

    const res = await listCandidates(
      db as any,
      { tenantId: TENANT_A, actorId: "mgr-1", role: "manager" },
      { include_inactive: false, limit: 25 } as never,
    );
    expect(res.items).toHaveLength(25);
    expect(res.next_cursor).not.toBeNull();
  });
});
