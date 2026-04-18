import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  clients: { id: "id", name: "name" },
  clientAssignments: { id: "id", clientId: "client_id", userId: "user_id", accountExecutiveId: "account_executive_id" },
  clientContacts: { _: "client_contacts_table" },
  clientPositions: { _: "client_positions_table" },
  clientDocuments: { _: "client_documents_table" },
  users: { id: "id", firstName: "first_name", lastName: "last_name", role: "role", isActive: "is_active" },
  auditEvents: { _: "audit_events_table" },
}));

const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const ACTOR_ID = "admin-uuid-1";

function createMockDb() {
  const chainable: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };
  return chainable;
}

describe("Client Service — createAssignment", () => {
  let createAssignment: typeof import("../service.js").createAssignment;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createAssignment = mod.createAssignment;
  });

  it("crea asignación cuando el usuario existe y está activo", async () => {
    const db = createMockDb();
    const assignmentRow = { id: "assign-1", tenantId: TENANT_ID, clientId: "client-1", userId: "user-1", accountExecutiveId: null, createdAt: new Date() };

    // Primera llamada a limit: usuario activo; segunda: no hay asignación existente
    let limitCalls = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCalls++;
      if (limitCalls === 1) return [{ id: "user-1", isActive: true }];
      return [];
    });
    db.returning = vi.fn().mockResolvedValue([assignmentRow]);

    const result = await createAssignment(db as any, TENANT_ID, ACTOR_ID, "client-1", "user-1");

    expect(result).toBeDefined();
    expect(result.id).toBe("assign-1");
    expect(db.insert).toHaveBeenCalled();
  });

  it("rechaza si el usuario está inactivo", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([{ id: "user-1", isActive: false }]);

    await expect(
      createAssignment(db as any, TENANT_ID, ACTOR_ID, "client-1", "user-1"),
    ).rejects.toThrow("USER_INACTIVE");
  });

  it("rechaza si el usuario ya está asignado", async () => {
    const db = createMockDb();
    let limitCalls = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCalls++;
      if (limitCalls === 1) return [{ id: "user-1", isActive: true }];
      return [{ id: "existing-assignment" }];
    });

    await expect(
      createAssignment(db as any, TENANT_ID, ACTOR_ID, "client-1", "user-1"),
    ).rejects.toThrow("ALREADY_ASSIGNED");
  });
});

describe("Client Service — deleteAssignment", () => {
  let deleteAssignment: typeof import("../service.js").deleteAssignment;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    deleteAssignment = mod.deleteAssignment;
  });

  it("elimina la asignación cuando existe", async () => {
    const db = createMockDb();
    const assignmentRow = { id: "assign-1", clientId: "client-1", userId: "user-1", accountExecutiveId: null };

    let limitCalls = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCalls++;
      if (limitCalls === 1) return [assignmentRow];
      return [{ role: "recruiter" }];
    });
    db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const result = await deleteAssignment(db as any, TENANT_ID, ACTOR_ID, "assign-1");

    expect(result).toBe(true);
  });

  it("retorna false cuando la asignación no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await deleteAssignment(db as any, TENANT_ID, ACTOR_ID, "nonexistent");

    expect(result).toBe(false);
  });
});

describe("Client Service — listAssignments", () => {
  let listAssignments: typeof import("../service.js").listAssignments;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    listAssignments = mod.listAssignments;
  });

  it("retorna lista vacía cuando no hay asignaciones", async () => {
    const db = createMockDb();
    // listAssignments: first where() → assignments (iterable), then select/from/where/limit for client name
    let whereCalls = 0;
    db.where = vi.fn().mockImplementation(() => {
      whereCalls++;
      if (whereCalls === 1) return []; // asignaciones vacías
      return db; // para la query del nombre del cliente
    });
    db.limit = vi.fn().mockResolvedValue([{ name: "Test Client" }]);

    const result = await listAssignments(db as any, "client-1");

    expect(result).toEqual([]);
  });
});
