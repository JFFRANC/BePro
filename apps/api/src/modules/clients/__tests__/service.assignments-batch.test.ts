// 008 expansion — batchAssignClient unit tests (mocked DB).
// Deep SQL behavior (cascade, reparent, re-add freshness) is covered by the
// real-Neon integration test at routes.batch.integration.test.ts.
import { describe, it, expect, vi, beforeEach } from "vitest";

const CLIENTS_REF = { _tag: "clients", id: "id", name: "name" };
const CLIENT_ASSIGNMENTS_REF = {
  _tag: "client_assignments",
  id: "id",
  clientId: "client_id",
  userId: "user_id",
  accountExecutiveId: "account_executive_id",
  tenantId: "tenant_id",
};
const USERS_REF = {
  _tag: "users",
  id: "id",
  firstName: "first_name",
  lastName: "last_name",
  role: "role",
  isActive: "is_active",
};
const AUDIT_EVENTS_REF = { _tag: "audit_events" };

vi.mock("@bepro/db", () => ({
  clients: CLIENTS_REF,
  clientAssignments: CLIENT_ASSIGNMENTS_REF,
  clientContacts: { _tag: "client_contacts" },
  clientPositions: { _tag: "client_positions" },
  clientDocuments: { _tag: "client_documents" },
  users: USERS_REF,
  auditEvents: AUDIT_EVENTS_REF,
}));

const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const ACTOR_ID = "admin-uuid-1";
const CLIENT_ID = "client-uuid-1";
const AE1 = "ae-uuid-0001";
const AE2 = "ae-uuid-0002";
const REC1 = "rec-uuid-0001";
const REC2 = "rec-uuid-0002";

interface StubRow {
  [k: string]: unknown;
}

/**
 * Builds a drizzle-like mock that routes `select().from(table)` to a result
 * array keyed by table identity. This avoids ordering issues when the service
 * legitimately skips some queries (e.g. empty desired sets).
 */
function buildDb(opts: {
  clientRow?: StubRow | null;
  userRows?: StubRow[];
  currentAssignments?: { userId: string; accountExecutiveId: string | null }[];
}) {
  const {
    clientRow = { id: CLIENT_ID },
    userRows = [],
    currentAssignments = [],
  } = opts;

  const inserted: StubRow[][] = [];
  const deleteCalls: unknown[] = [];
  const auditCalls: StubRow[] = [];

  const resultsByTable = new Map<unknown, unknown[]>([
    [CLIENTS_REF, clientRow ? [clientRow] : []],
    [USERS_REF, userRows],
    [CLIENT_ASSIGNMENTS_REF, currentAssignments],
  ]);

  const makeSelectChain = () => {
    let target: unknown = null;
    const chain: Record<string, unknown> = {};
    const thenable: Record<string, unknown> = {
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
        const result = (target && resultsByTable.get(target)) ?? [];
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    chain.from = vi.fn((table: unknown) => {
      target = table;
      return chain;
    });
    chain.where = vi.fn(() => Object.assign(thenable, chain));
    chain.limit = vi.fn(() => Object.assign(thenable, chain));
    chain.innerJoin = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    return chain;
  };

  const db = {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((rows) => {
        const asArray = Array.isArray(rows) ? rows : [rows];
        if (table === AUDIT_EVENTS_REF) {
          for (const r of asArray) auditCalls.push(r as StubRow);
        } else {
          inserted.push(asArray as StubRow[]);
        }
        return Promise.resolve();
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn((w) => {
        deleteCalls.push(w);
        return Promise.resolve();
      }),
    })),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(db)),
  } as unknown;

  return { db, inserted, deleteCalls, auditCalls };
}

describe("batchAssignClient", () => {
  let batchAssignClient: typeof import("../service.js").batchAssignClient;
  let BatchAssignmentValidationError: typeof import("../service.js").BatchAssignmentValidationError;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    batchAssignClient = mod.batchAssignClient;
    BatchAssignmentValidationError = mod.BatchAssignmentValidationError;
  });

  it("throws CLIENT_NOT_FOUND when the client is not visible in the tenant", async () => {
    const { db } = buildDb({ clientRow: null });
    await expect(
      batchAssignClient(db as never, TENANT_ID, ACTOR_ID, CLIENT_ID, {
        accountExecutives: [AE1],
        recruiters: [],
      }),
    ).rejects.toThrow(/CLIENT_NOT_FOUND/);
  });

  it("rejects an AE userId whose role in the DB is not account_executive", async () => {
    const { db } = buildDb({
      userRows: [{ id: AE1, role: "recruiter", isActive: true }],
      currentAssignments: [],
    });
    await expect(
      batchAssignClient(db as never, TENANT_ID, ACTOR_ID, CLIENT_ID, {
        accountExecutives: [AE1],
        recruiters: [],
      }),
    ).rejects.toBeInstanceOf(BatchAssignmentValidationError);
  });

  it("rejects an inactive user even with the right role", async () => {
    const { db } = buildDb({
      userRows: [{ id: AE1, role: "account_executive", isActive: false }],
      currentAssignments: [],
    });
    await expect(
      batchAssignClient(db as never, TENANT_ID, ACTOR_ID, CLIENT_ID, {
        accountExecutives: [AE1],
        recruiters: [],
      }),
    ).rejects.toBeInstanceOf(BatchAssignmentValidationError);
  });

  it("rejects an admin/manager userId — only AE or recruiter assignable", async () => {
    const { db } = buildDb({
      userRows: [{ id: AE1, role: "admin", isActive: true }],
      currentAssignments: [],
    });
    await expect(
      batchAssignClient(db as never, TENANT_ID, ACTOR_ID, CLIENT_ID, {
        accountExecutives: [AE1],
        recruiters: [],
      }),
    ).rejects.toBeInstanceOf(BatchAssignmentValidationError);
  });

  it("happy path: returns added rows tagged by role and empty removed/reparented/unchanged for a fresh client", async () => {
    const { db, inserted } = buildDb({
      userRows: [
        { id: AE1, role: "account_executive", isActive: true },
        { id: REC1, role: "recruiter", isActive: true },
      ],
      currentAssignments: [],
    });
    const result = await batchAssignClient(
      db as never,
      TENANT_ID,
      ACTOR_ID,
      CLIENT_ID,
      {
        accountExecutives: [AE1],
        recruiters: [{ userId: REC1, accountExecutiveId: AE1 }],
      },
    );
    expect(result.clientId).toBe(CLIENT_ID);
    expect(result.added.map((a) => a.userId).sort()).toEqual([AE1, REC1].sort());
    expect(
      result.added.find((a) => a.userId === AE1)?.role,
    ).toBe("account_executive");
    expect(result.added.find((a) => a.userId === REC1)?.role).toBe("recruiter");
    expect(result.removed).toEqual([]);
    expect(result.reparented).toEqual([]);
    expect(result.unchanged).toEqual([]);
    // Exactly one insert batch with both rows.
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toHaveLength(2);
  });

  it("reparents a recruiter when their desired accountExecutiveId differs from the current row", async () => {
    const { db, inserted, deleteCalls } = buildDb({
      userRows: [
        { id: AE1, role: "account_executive", isActive: true },
        { id: AE2, role: "account_executive", isActive: true },
        { id: REC1, role: "recruiter", isActive: true },
      ],
      currentAssignments: [
        { userId: AE1, accountExecutiveId: null },
        { userId: AE2, accountExecutiveId: null },
        { userId: REC1, accountExecutiveId: AE1 },
      ],
    });
    const result = await batchAssignClient(
      db as never,
      TENANT_ID,
      ACTOR_ID,
      CLIENT_ID,
      {
        accountExecutives: [AE1, AE2],
        recruiters: [{ userId: REC1, accountExecutiveId: AE2 }],
      },
    );
    expect(result.reparented).toHaveLength(1);
    expect(result.reparented[0]).toMatchObject({
      userId: REC1,
      from: AE1,
      to: AE2,
    });
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    // The reparent performs DELETE + INSERT on the recruiter row.
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
    expect(inserted).toHaveLength(1);
  });

  it("cascade-deletes a recruiter whose leader AE is removed and who is not re-parented in the same request", async () => {
    const { db, deleteCalls } = buildDb({
      currentAssignments: [
        { userId: AE1, accountExecutiveId: null },
        { userId: REC1, accountExecutiveId: AE1 },
      ],
    });
    const result = await batchAssignClient(
      db as never,
      TENANT_ID,
      ACTOR_ID,
      CLIENT_ID,
      {
        accountExecutives: [],
        recruiters: [],
      },
    );
    expect(result.removed.map((r) => r.userId).sort()).toEqual(
      [AE1, REC1].sort(),
    );
    expect(
      result.removed.find((r) => r.userId === REC1)?.reason,
    ).toBe("cascade");
    expect(result.removed.find((r) => r.userId === AE1)?.reason).toBe(
      "explicit",
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("idempotent: sending the current state yields all unchanged and no writes", async () => {
    const { db, inserted, deleteCalls } = buildDb({
      userRows: [
        { id: AE1, role: "account_executive", isActive: true },
        { id: REC1, role: "recruiter", isActive: true },
      ],
      currentAssignments: [
        { userId: AE1, accountExecutiveId: null },
        { userId: REC1, accountExecutiveId: AE1 },
      ],
    });
    const result = await batchAssignClient(
      db as never,
      TENANT_ID,
      ACTOR_ID,
      CLIENT_ID,
      {
        accountExecutives: [AE1],
        recruiters: [{ userId: REC1, accountExecutiveId: AE1 }],
      },
    );
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.reparented).toEqual([]);
    expect(result.unchanged.sort()).toEqual([AE1, REC1].sort());
    expect(inserted).toEqual([]);
    expect(deleteCalls).toEqual([]);
  });

  it("rejects a recruiter.accountExecutiveId that points at a user whose live role is not AE", async () => {
    const { db } = buildDb({
      userRows: [
        // AE1 is claimed by the client, but DB says it's a manager (tampering path)
        { id: AE1, role: "manager", isActive: true },
        { id: REC1, role: "recruiter", isActive: true },
      ],
      currentAssignments: [],
    });
    await expect(
      batchAssignClient(db as never, TENANT_ID, ACTOR_ID, CLIENT_ID, {
        accountExecutives: [AE1],
        recruiters: [{ userId: REC1, accountExecutiveId: AE1 }],
      }),
    ).rejects.toBeInstanceOf(BatchAssignmentValidationError);
  });
});
