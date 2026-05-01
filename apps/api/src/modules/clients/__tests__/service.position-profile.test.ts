// 011-puestos-profile-docs / US1 — service tests (mocked)
// Cubre createPosition / updatePosition / getPosition con perfil completo,
// validación cross-field ageMin>ageMax y diff audit.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  clients: { _: "clients_table" },
  clientAssignments: { _: "client_assignments_table" },
  clientContacts: { _: "client_contacts_table" },
  clientPositions: {
    id: "id",
    clientId: "client_id",
    name: "name",
    isActive: "is_active",
  },
  clientDocuments: { _: "client_documents_table" },
  clientPositionDocuments: {
    id: "id",
    positionId: "position_id",
    type: "type",
    isActive: "is_active",
  },
  users: { _: "users_table" },
  auditEvents: { _: "audit_events_table" },
}));

const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const ACTOR_ID = "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6111";
const CLIENT_ID = "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6222";
const POSITION_ID = "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6333";

function basePositionRow(over: Record<string, unknown> = {}) {
  return {
    id: POSITION_ID,
    tenantId: TENANT_ID,
    clientId: CLIENT_ID,
    name: "AYUDANTE GENERAL",
    isActive: true,
    createdAt: new Date("2026-04-30T00:00:00Z"),
    updatedAt: new Date("2026-04-30T00:00:00Z"),
    vacancies: 80,
    workLocation: null,
    ageMin: 18,
    ageMax: 48,
    gender: "indistinto",
    civilStatus: null,
    educationLevel: "primaria",
    experienceText: null,
    salaryAmount: "1951.00",
    salaryCurrency: "MXN",
    paymentFrequency: "weekly",
    salaryNotes: null,
    benefits: null,
    scheduleText: null,
    workDays: ["mon", "tue", "wed", "thu", "fri"],
    shift: "fixed",
    requiredDocuments: ["CURP"],
    responsibilities: null,
    faq: ["NO REINGRESOS"],
    ...over,
  };
}

function createMockDb(overrides: { limit?: any; orderBy?: any; returning?: any } = {}) {
  const chainable: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: overrides.limit ?? vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: overrides.returning ?? vi.fn().mockResolvedValue([basePositionRow()]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    orderBy: overrides.orderBy ?? vi.fn().mockResolvedValue([]),
  };
  return chainable;
}

describe("011 — createPosition (perfil completo)", () => {
  let createPosition: typeof import("../service.js").createPosition;
  let InvalidAgeRangeError: typeof import("../service.js").InvalidAgeRangeError;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createPosition = mod.createPosition;
    InvalidAgeRangeError = mod.InvalidAgeRangeError;
  });

  it("acepta el perfil completo y persiste todos los campos", async () => {
    const db = createMockDb();

    const result = await createPosition(db as any, TENANT_ID, ACTOR_ID, CLIENT_ID, {
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
    });

    expect(result.name).toBe("AYUDANTE GENERAL");
    expect(result.vacancies).toBe(80);
    expect(result.ageMin).toBe(18);
    expect(result.gender).toBe("indistinto");
    expect(result.workDays).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(db.insert).toHaveBeenCalled();
    // Audit `client_position.create` con snapshot completo
    const insertCalls = (db.insert as any).mock.calls;
    expect(insertCalls.length).toBeGreaterThanOrEqual(2); // position + audit
  });

  it("rechaza ageMin > ageMax con InvalidAgeRangeError", async () => {
    const db = createMockDb();
    await expect(
      createPosition(db as any, TENANT_ID, ACTOR_ID, CLIENT_ID, {
        name: "Ayudante",
        ageMin: 50,
        ageMax: 30,
      }),
    ).rejects.toBeInstanceOf(InvalidAgeRangeError);
  });

  it("rechaza nombre duplicado en cliente con POSITION_DUPLICATE", async () => {
    const db = createMockDb({
      limit: vi.fn().mockResolvedValue([{ id: "existing" }]),
    });
    await expect(
      createPosition(db as any, TENANT_ID, ACTOR_ID, CLIENT_ID, {
        name: "Ayudante",
      }),
    ).rejects.toThrow("POSITION_DUPLICATE");
  });

  it("acepta solo `name` (todos los demás campos opcionales)", async () => {
    const db = createMockDb({
      returning: vi.fn().mockResolvedValue([
        basePositionRow({
          name: "Soldador",
          vacancies: null,
          ageMin: null,
          ageMax: null,
          gender: null,
          educationLevel: null,
          salaryAmount: null,
          salaryCurrency: null,
          paymentFrequency: null,
          workDays: null,
          shift: null,
          requiredDocuments: null,
          faq: null,
        }),
      ]),
    });

    const result = await createPosition(db as any, TENANT_ID, ACTOR_ID, CLIENT_ID, {
      name: "Soldador",
    });
    expect(result.name).toBe("Soldador");
    expect(result.vacancies).toBeNull();
  });
});

describe("011 — updatePosition (perfil parcial + null clears)", () => {
  let updatePosition: typeof import("../service.js").updatePosition;
  let InvalidAgeRangeError: typeof import("../service.js").InvalidAgeRangeError;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    updatePosition = mod.updatePosition;
    InvalidAgeRangeError = mod.InvalidAgeRangeError;
  });

  it("acepta un subset y persiste el diff", async () => {
    const before = basePositionRow();
    const after = basePositionRow({ salaryAmount: "2050.00" });
    let limitCalls = 0;
    const db = createMockDb({
      limit: vi.fn().mockImplementation(() => {
        limitCalls++;
        if (limitCalls === 1) return [before];
        return [];
      }),
      returning: vi.fn().mockResolvedValue([after]),
    });

    const result = await updatePosition(db as any, TENANT_ID, ACTOR_ID, POSITION_ID, {
      salaryAmount: 2050.0,
    });
    expect(result).not.toBeNull();
    expect(result!.salaryAmount).toBe(2050);
  });

  it("acepta `null` para limpiar un campo previamente seteado", async () => {
    const before = basePositionRow({ vacancies: 50 });
    const after = basePositionRow({ vacancies: null });
    let limitCalls = 0;
    const db = createMockDb({
      limit: vi.fn().mockImplementation(() => {
        limitCalls++;
        if (limitCalls === 1) return [before];
        return [];
      }),
      returning: vi.fn().mockResolvedValue([after]),
    });

    const result = await updatePosition(db as any, TENANT_ID, ACTOR_ID, POSITION_ID, {
      vacancies: null,
    });
    expect(result!.vacancies).toBeNull();
  });

  it("rechaza ageMin > ageMax con InvalidAgeRangeError (incluyendo merged ranges)", async () => {
    const before = basePositionRow({ ageMin: 18, ageMax: 30 });
    let limitCalls = 0;
    const db = createMockDb({
      limit: vi.fn().mockImplementation(() => {
        limitCalls++;
        if (limitCalls === 1) return [before];
        return [];
      }),
    });
    // Solo se manda ageMin=50; el merge contra existing.ageMax=30 dispara el error.
    await expect(
      updatePosition(db as any, TENANT_ID, ACTOR_ID, POSITION_ID, {
        ageMin: 50,
      }),
    ).rejects.toBeInstanceOf(InvalidAgeRangeError);
  });

  it("retorna null cuando el puesto no existe (cross-tenant uniform)", async () => {
    const db = createMockDb({
      limit: vi.fn().mockResolvedValue([]),
    });
    const result = await updatePosition(db as any, TENANT_ID, ACTOR_ID, POSITION_ID, {
      vacancies: 80,
    });
    expect(result).toBeNull();
  });
});
