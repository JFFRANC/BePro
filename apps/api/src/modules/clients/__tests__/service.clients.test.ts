import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  clients: { id: "id", tenantId: "tenant_id", name: "name", isActive: "is_active" },
  clientAssignments: { id: "id", clientId: "client_id", userId: "user_id" },
  clientContacts: { _: "client_contacts_table" },
  clientPositions: { _: "client_positions_table" },
  clientDocuments: { _: "client_documents_table" },
  users: { id: "id", firstName: "first_name", lastName: "last_name", role: "role", isActive: "is_active" },
  auditEvents: { _: "audit_events_table" },
}));

const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const ACTOR_ID = "admin-uuid-1";

const sampleClientRow = {
  id: "client-uuid-1",
  tenantId: TENANT_ID,
  name: "Empresa ABC",
  email: "info@empresa.com",
  phone: "+52 55 1234 5678",
  address: "Av. Reforma 123",
  latitude: "19.4326077",
  longitude: "-99.1332080",
  formConfig: {
    showInterviewTime: false,
    showPosition: false,
    showMunicipality: false,
    showAge: false,
    showShift: false,
    showPlant: false,
    showInterviewPoint: false,
    showComments: false,
  },
  isActive: true,
  createdAt: new Date("2026-04-15T00:00:00Z"),
  updatedAt: new Date("2026-04-15T00:00:00Z"),
};

function createMockDb(options: {
  selectResult?: unknown[];
  countResult?: number;
  insertResult?: unknown[];
} = {}) {
  const { selectResult = [], countResult = 0, insertResult = [sampleClientRow] } = options;

  const chainable: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      // Devolver selectResult por defecto
      chainable._lastResult = selectResult;
      return chainable;
    }),
    limit: vi.fn().mockImplementation(() => chainable._lastResult ?? selectResult),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockImplementation(() => chainable._lastResult ?? selectResult),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(insertResult),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    _lastResult: null,
  };

  return chainable;
}

describe("Client Service — createClient", () => {
  let createClient: typeof import("../service.js").createClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createClient = mod.createClient;
  });

  it("crea un cliente con datos válidos y retorna un DTO", async () => {
    const db = createMockDb({ insertResult: [sampleClientRow] });

    const result = await createClient(db as any, TENANT_ID, ACTOR_ID, {
      name: "Empresa ABC",
      email: "info@empresa.com",
  phone: "+52 55 1234 5678",
      address: "Av. Reforma 123",
      latitude: 19.4326077,
      longitude: -99.1332080,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe("client-uuid-1");
    expect(result.name).toBe("Empresa ABC");
    expect(result.latitude).toBe(19.4326077);
    expect(result.longitude).toBe(-99.133208);
    expect(result.isActive).toBe(true);
    expect(result.formConfig).toBeDefined();
    expect(db.insert).toHaveBeenCalled();
  });

  it("aplica formConfig por defecto cuando no se proporciona", async () => {
    const db = createMockDb({ insertResult: [sampleClientRow] });

    const result = await createClient(db as any, TENANT_ID, ACTOR_ID, {
      name: "Empresa sin config",
    });

    expect(result.formConfig.showInterviewTime).toBe(false);
    expect(result.formConfig.showPosition).toBe(false);
  });
});

describe("Client Service — getClientById", () => {
  let getClientById: typeof import("../service.js").getClientById;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    getClientById = mod.getClientById;
  });

  it("retorna el cliente cuando existe", async () => {
    const db = createMockDb();
    // Mock para que limit() devuelva el cliente
    db.limit = vi.fn().mockResolvedValue([sampleClientRow]);

    const result = await getClientById(db as any, "client-uuid-1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("client-uuid-1");
    expect(result!.name).toBe("Empresa ABC");
  });

  it("retorna null cuando no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await getClientById(db as any, "nonexistent-uuid");

    expect(result).toBeNull();
  });
});

describe("Client Service — updateClient", () => {
  let updateClient: typeof import("../service.js").updateClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    updateClient = mod.updateClient;
  });

  it("actualiza campos parciales y retorna el DTO actualizado", async () => {
    const updatedRow = { ...sampleClientRow, name: "Nuevo Nombre" };
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([sampleClientRow]);
    db.returning = vi.fn().mockResolvedValue([updatedRow]);

    const result = await updateClient(db as any, TENANT_ID, ACTOR_ID, "client-uuid-1", {
      name: "Nuevo Nombre",
    });

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Nuevo Nombre");
  });

  it("puede desactivar un cliente con isActive: false", async () => {
    const deactivated = { ...sampleClientRow, isActive: false };
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([sampleClientRow]);
    db.returning = vi.fn().mockResolvedValue([deactivated]);

    const result = await updateClient(db as any, TENANT_ID, ACTOR_ID, "client-uuid-1", {
      isActive: false,
    });

    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(false);
  });

  it("retorna null cuando el cliente no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await updateClient(db as any, TENANT_ID, ACTOR_ID, "nonexistent-uuid", {
      name: "No existe",
    });

    expect(result).toBeNull();
  });
});

describe("Client Service — verifyClientAccess", () => {
  let verifyClientAccess: typeof import("../service.js").verifyClientAccess;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    verifyClientAccess = mod.verifyClientAccess;
  });

  it("admin siempre tiene acceso", async () => {
    const db = createMockDb();
    const result = await verifyClientAccess(db as any, "admin-uuid", "admin", "client-uuid-1");
    expect(result).toBe(true);
  });

  it("manager siempre tiene acceso", async () => {
    const db = createMockDb();
    const result = await verifyClientAccess(db as any, "manager-uuid", "manager", "client-uuid-1");
    expect(result).toBe(true);
  });

  it("account_executive tiene acceso si está asignado", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([{ id: "assignment-uuid" }]);

    const result = await verifyClientAccess(db as any, "ae-uuid", "account_executive", "client-uuid-1");
    expect(result).toBe(true);
  });

  it("account_executive no tiene acceso si no está asignado", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await verifyClientAccess(db as any, "ae-uuid", "account_executive", "client-uuid-1");
    expect(result).toBe(false);
  });

  it("recruiter tiene acceso solo si está asignado", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await verifyClientAccess(db as any, "recruiter-uuid", "recruiter", "client-uuid-1");
    expect(result).toBe(false);
  });
});

describe("Client Service — verifyClientWriteAccess", () => {
  let verifyClientWriteAccess: typeof import("../service.js").verifyClientWriteAccess;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    verifyClientWriteAccess = mod.verifyClientWriteAccess;
  });

  it("admin siempre tiene acceso de escritura", async () => {
    const db = createMockDb();
    const result = await verifyClientWriteAccess(db as any, "admin-uuid", "admin", "client-uuid-1");
    expect(result).toBe(true);
  });

  it("manager NO tiene acceso de escritura", async () => {
    const db = createMockDb();
    const result = await verifyClientWriteAccess(db as any, "manager-uuid", "manager", "client-uuid-1");
    expect(result).toBe(false);
  });

  it("account_executive tiene acceso de escritura si está asignado", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([{ id: "assignment-uuid" }]);

    const result = await verifyClientWriteAccess(db as any, "ae-uuid", "account_executive", "client-uuid-1");
    expect(result).toBe(true);
  });

  it("recruiter NO tiene acceso de escritura", async () => {
    const db = createMockDb();
    const result = await verifyClientWriteAccess(db as any, "recruiter-uuid", "recruiter", "client-uuid-1");
    expect(result).toBe(false);
  });
});
