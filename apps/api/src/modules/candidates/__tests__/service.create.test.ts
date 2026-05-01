import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  candidates: { _: "candidates_table", id: "id", tenantId: "tenant_id", clientId: "client_id" },
  candidateDuplicateLinks: { _: "candidate_duplicate_links_table" },
  clients: { _: "clients_table", id: "id", tenantId: "tenant_id" },
  // 012-client-detail-ux — clientPositions FK (positionId).
  clientPositions: { _: "client_positions_table", id: "id", clientId: "client_id", isActive: "is_active" },
  clientAssignments: { _: "client_assignments_table" },
  privacyNotices: {
    _: "privacy_notices_table",
    id: "id",
    tenantId: "tenant_id",
    isActive: "is_active",
    effectiveFrom: "effective_from",
  },
  users: { _: "users_table", id: "id" },
  auditEvents: { _: "audit_events_table" },
}));

const TENANT_ID = "11111111-1111-4111-9111-111111111111";
const CLIENT_ID = "22222222-2222-4222-9222-222222222222";
const ACTOR_ID = "33333333-3333-4333-9333-333333333333";
const NOTICE_ID = "44444444-4444-4444-9444-444444444444";
const NEW_CANDIDATE_ID = "55555555-5555-4555-9555-555555555555";

interface MockOptions {
  client?: Record<string, unknown> | null;
  notice?: Record<string, unknown> | null;
  duplicates?: Array<Record<string, unknown>>;
  recruiter?: Record<string, unknown> | null;
  insertedRow?: Record<string, unknown>;
}

function createMockDb(options: MockOptions = {}) {
  const {
    client = {
      id: CLIENT_ID,
      name: "Cliente Demo",
      formConfig: {},
      isActive: true,
    },
    notice = { id: NOTICE_ID, version: "2026-04", isActive: true },
    duplicates = [],
    recruiter = {
      id: ACTOR_ID,
      firstName: "Hector",
      lastName: "Franco",
    },
    insertedRow = {
      id: NEW_CANDIDATE_ID,
      tenantId: TENANT_ID,
      clientId: CLIENT_ID,
      registeringUserId: ACTOR_ID,
      firstName: "Juan",
      lastName: "Pérez",
      phone: "+52 55 1234 5678",
      phoneNormalized: "5512345678",
      email: "juan.perez@example.com",
      currentPosition: null,
      source: "LinkedIn",
      status: "registered",
      additionalFields: {},
      rejectionCategoryId: null,
      declineCategoryId: null,
      privacyNoticeId: NOTICE_ID,
      privacyNoticeAcknowledgedAt: new Date("2026-04-21T12:00:00Z"),
      isActive: true,
      createdAt: new Date("2026-04-21T12:00:00Z"),
      updatedAt: new Date("2026-04-21T12:00:00Z"),
    },
  } = options;

  // Diferentes selects regresan distintos resultados; rastreamos por la "primera tabla".
  // 012-client-detail-ux — el orden de selects ahora es:
  //   1) clients
  //   2) privacy_notices (rama del active notice)
  //   3) client_positions (validación FK del positionId — NUEVO)
  //   4) candidates (findDuplicatesForCandidate)
  //   5) (si hay dups) users → recruiter display
  //   6) recruiter final lookup
  const VALID_POSITION_ID = "66666666-6666-4666-9666-666666666666";
  let selectCallCount = 0;
  const selectResults: unknown[][] = [
    client ? [client] : [],
    notice ? [notice] : [],
    // 012 — positionId FK. Por defecto la posición existe para facilitar el happy path.
    [{ id: VALID_POSITION_ID }],
    duplicates,
    duplicates.length > 0 ? [recruiter] : [],
    [recruiter],
  ];

  const insertedRows: Array<Record<string, unknown>> = [];
  const auditedRows: Array<Record<string, unknown>> = [];
  const dupLinksInserted: Array<Record<string, unknown>> = [];

  const chainable: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      const result = selectResults[selectCallCount] ?? [];
      selectCallCount++;
      // Ese where puede ser seguido por orderBy/limit; devolvemos chainable + thenable
      const promiseLike = Promise.resolve(result);
      return Object.assign(promiseLike, {
        orderBy: () => Object.assign(Promise.resolve(result), { limit: () => Promise.resolve(result) }),
        limit: () => Promise.resolve(result),
        innerJoin: () => chainable,
      });
    }),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockImplementation((table: any) => {
      const target = table?._;
      return {
        values: vi.fn().mockImplementation((vals: any) => {
          if (target === "candidate_duplicate_links_table") {
            const arr = Array.isArray(vals) ? vals : [vals];
            dupLinksInserted.push(...arr);
            return Promise.resolve();
          }
          if (target === "audit_events_table") {
            auditedRows.push(vals);
            return Promise.resolve();
          }
          insertedRows.push(vals);
          return {
            returning: vi.fn().mockResolvedValue([insertedRow]),
          };
        }),
      };
    }),
  };

  return { db: chainable, insertedRows, auditedRows, dupLinksInserted };
}

// 012-client-detail-ux — additional_fields ahora DEBE contener los 9 campos
// base (FR-012). Sin ellos el dynamic schema falla con FormConfigValidationError.
const VALID_POSITION_ID = "66666666-6666-4666-9666-666666666666";
const baseInput = {
  client_id: CLIENT_ID,
  first_name: "Juan",
  last_name: "Pérez",
  phone: "+52 55 1234 5678",
  email: "juan.perez@example.com",
  source: "LinkedIn",
  privacy_notice_id: NOTICE_ID,
  privacy_acknowledged: true as const,
  additional_fields: {
    fullName: "Juan Pérez",
    interviewPhone: "+52 55 1234 5678",
    interviewDate: "2026-05-15",
    interviewTime: "10:30",
    positionId: VALID_POSITION_ID,
    state: "Querétaro",
    municipality: "San Juan del Río",
    recruiterName: "Hector Franco",
    accountExecutiveName: "Javier Romero",
  },
};

describe("createCandidate (US1)", () => {
  let createCandidate: typeof import("../service.js").createCandidate;
  let DuplicatesDetectedError: typeof import("../service.js").DuplicatesDetectedError;
  let PrivacyNoticeMismatchError: typeof import("../service.js").PrivacyNoticeMismatchError;
  let ClientNotFoundError: typeof import("../service.js").ClientNotFoundError;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createCandidate = mod.createCandidate;
    DuplicatesDetectedError = mod.DuplicatesDetectedError;
    PrivacyNoticeMismatchError = mod.PrivacyNoticeMismatchError;
    ClientNotFoundError = mod.ClientNotFoundError;
  });

  it("happy path — inserta candidato + audit row, sin duplicados", async () => {
    const { db, insertedRows, auditedRows, dupLinksInserted } = createMockDb();

    const result = await createCandidate(db, { tenantId: TENANT_ID, actorId: ACTOR_ID }, baseInput);

    expect(result.candidate.id).toBe(NEW_CANDIDATE_ID);
    expect(result.candidate.status).toBe("registered");
    expect(result.candidate.is_active).toBe(true);

    // Insertó en candidates con phone_normalized derivado.
    expect(insertedRows.length).toBeGreaterThan(0);
    expect(insertedRows[0]).toMatchObject({
      tenantId: TENANT_ID,
      clientId: CLIENT_ID,
      registeringUserId: ACTOR_ID,
      phoneNormalized: "5512345678",
      status: "registered",
    });

    // Audit event candidate.created sin PII.
    expect(auditedRows).toHaveLength(1);
    expect(auditedRows[0]).toMatchObject({
      action: "candidate.created",
      targetType: "candidate",
      targetId: NEW_CANDIDATE_ID,
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
    });
    const newValues = (auditedRows[0] as any).newValues;
    expect(newValues.first_name).toBeUndefined();
    expect(newValues.email).toBeUndefined();
    expect(newValues.phone).toBeUndefined();
    expect(newValues.privacy_notice_id).toBe(NOTICE_ID);

    // Sin duplicados confirmados → sin links.
    expect(dupLinksInserted).toHaveLength(0);
  });

  it("409 — devuelve DuplicatesDetectedError cuando hay duplicados sin confirmar", async () => {
    const dup = {
      id: "existing-cand-1",
      first_name: "Juan",
      last_name: "Pérez",
      status: "interview_scheduled",
      created_at: new Date("2026-03-01T00:00:00Z"),
      registering_user_id: "another-recruiter",
      phone_normalized: "5512345678",
    };
    const { db } = createMockDb({ duplicates: [dup] });

    await expect(
      createCandidate(db, { tenantId: TENANT_ID, actorId: ACTOR_ID }, baseInput),
    ).rejects.toBeInstanceOf(DuplicatesDetectedError);
  });

  it("inserta candidate_duplicate_links cuando se confirman duplicados", async () => {
    const dup = {
      id: "existing-cand-1",
      first_name: "Juan",
      last_name: "Pérez",
      status: "interview_scheduled",
      created_at: new Date("2026-03-01T00:00:00Z"),
      registering_user_id: "another-recruiter",
      phone_normalized: "5512345678",
    };
    const { db, dupLinksInserted } = createMockDb({ duplicates: [dup] });

    const result = await createCandidate(
      db,
      { tenantId: TENANT_ID, actorId: ACTOR_ID },
      {
        ...baseInput,
        duplicate_confirmation: { confirmed_duplicate_ids: ["existing-cand-1"] },
      },
    );

    expect(result.candidate.id).toBe(NEW_CANDIDATE_ID);
    expect(dupLinksInserted).toHaveLength(1);
    expect(dupLinksInserted[0]).toMatchObject({
      candidateId: NEW_CANDIDATE_ID,
      duplicateOfCandidateId: "existing-cand-1",
      confirmedByUserId: ACTOR_ID,
      tenantId: TENANT_ID,
    });
  });

  it("422 — privacy_notice_id no coincide con el aviso activo", async () => {
    const { db } = createMockDb({ notice: null });

    await expect(
      createCandidate(db, { tenantId: TENANT_ID, actorId: ACTOR_ID }, baseInput),
    ).rejects.toBeInstanceOf(PrivacyNoticeMismatchError);
  });

  it("404 — cliente no existe / inactivo", async () => {
    const { db } = createMockDb({ client: null });

    await expect(
      createCandidate(db, { tenantId: TENANT_ID, actorId: ACTOR_ID }, baseInput),
    ).rejects.toBeInstanceOf(ClientNotFoundError);
  });
});
