import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  clients: { _: "clients_table" },
  clientAssignments: { _: "client_assignments_table" },
  clientContacts: { _: "client_contacts_table" },
  clientPositions: { id: "id", clientId: "client_id", name: "name", isActive: "is_active" },
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
const ACTOR_ID = "admin-uuid-1";

const samplePositionRow = {
  id: "position-uuid-1",
  tenantId: TENANT_ID,
  clientId: "client-uuid-1",
  name: "Ayudante General",
  isActive: true,
  createdAt: new Date("2026-04-15T00:00:00Z"),
  updatedAt: new Date("2026-04-15T00:00:00Z"),
};

function createMockDb() {
  const chainable: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([samplePositionRow]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };
  return chainable;
}

describe("Client Service — createPosition", () => {
  let createPosition: typeof import("../service.js").createPosition;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createPosition = mod.createPosition;
  });

  it("crea un puesto con nombre válido", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await createPosition(db as any, TENANT_ID, ACTOR_ID, "client-uuid-1", {
      name: "Ayudante General",
    });

    expect(result).toBeDefined();
    expect(result.id).toBe("position-uuid-1");
    expect(result.name).toBe("Ayudante General");
    expect(result.isActive).toBe(true);
    expect(db.insert).toHaveBeenCalled();
  });

  it("rechaza si ya existe un puesto activo con el mismo nombre", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([{ id: "existing-position" }]);

    await expect(
      createPosition(db as any, TENANT_ID, ACTOR_ID, "client-uuid-1", {
        name: "Ayudante General",
      }),
    ).rejects.toThrow("POSITION_DUPLICATE");
  });
});

describe("Client Service — listPositions", () => {
  let listPositions: typeof import("../service.js").listPositions;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    listPositions = mod.listPositions;
  });

  // 011 — listPositions ahora hace dos queries:
  //   1) select().from(positions).where(...).orderBy(name)  (chainable hasta orderBy)
  //   2) select({...}).from(documents).where(and(...))      (await directo)
  // Para no romper la mock en cadena, distinguimos la primera llamada a `where`
  // (devuelve un sub-chainable con orderBy) de la segunda (devuelve la promesa
  // de filas de documentos).
  function setupListMock(db: any, positionRows: any[], docRows: any[] = []) {
    let whereCalls = 0;
    db.where = vi.fn(() => {
      whereCalls++;
      if (whereCalls === 1) {
        return { orderBy: vi.fn().mockResolvedValue(positionRows) };
      }
      return Promise.resolve(docRows);
    });
  }

  it("retorna solo puestos activos por defecto", async () => {
    const db = createMockDb();
    setupListMock(db, [samplePositionRow]);

    const result = await listPositions(db as any, "client-uuid-1");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Ayudante General");
    expect(result[0].documents).toEqual({});
  });

  it("retorna todos los puestos incluyendo inactivos cuando se solicita", async () => {
    const inactiveRow = { ...samplePositionRow, id: "pos-2", name: "Taladrista", isActive: false };
    const db = createMockDb();
    setupListMock(db, [samplePositionRow, inactiveRow]);

    const result = await listPositions(db as any, "client-uuid-1", true);

    expect(result).toHaveLength(2);
  });
});

describe("Client Service — updatePosition", () => {
  let updatePosition: typeof import("../service.js").updatePosition;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    updatePosition = mod.updatePosition;
  });

  it("actualiza el nombre del puesto", async () => {
    const updatedRow = { ...samplePositionRow, name: "Montacarguista" };
    const db = createMockDb();
    // Primera limit: existente; segunda: sin duplicados
    let limitCalls = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCalls++;
      if (limitCalls === 1) return [samplePositionRow];
      return [];
    });
    db.returning = vi.fn().mockResolvedValue([updatedRow]);

    const result = await updatePosition(db as any, TENANT_ID, ACTOR_ID, "position-uuid-1", {
      name: "Montacarguista",
    });

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Montacarguista");
  });

  it("rechaza si el nuevo nombre duplica un puesto activo existente", async () => {
    const db = createMockDb();
    let limitCalls = 0;
    db.limit = vi.fn().mockImplementation(() => {
      limitCalls++;
      if (limitCalls === 1) return [samplePositionRow];
      return [{ id: "duplicate-id" }];
    });

    await expect(
      updatePosition(db as any, TENANT_ID, ACTOR_ID, "position-uuid-1", {
        name: "Taladrista",
      }),
    ).rejects.toThrow("POSITION_DUPLICATE");
  });

  it("retorna null cuando el puesto no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await updatePosition(db as any, TENANT_ID, ACTOR_ID, "nonexistent", {
      name: "No existe",
    });

    expect(result).toBeNull();
  });
});

describe("Client Service — deletePosition", () => {
  let deletePosition: typeof import("../service.js").deletePosition;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    deletePosition = mod.deletePosition;
  });

  it("elimina el puesto cuando existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([samplePositionRow]);
    db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const result = await deletePosition(db as any, TENANT_ID, ACTOR_ID, "position-uuid-1");

    expect(result).toBe(true);
  });

  it("retorna false cuando el puesto no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await deletePosition(db as any, TENANT_ID, ACTOR_ID, "nonexistent");

    expect(result).toBe(false);
  });
});
