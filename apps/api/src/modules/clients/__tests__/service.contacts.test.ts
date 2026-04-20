import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  clients: { _: "clients_table" },
  clientAssignments: { _: "client_assignments_table" },
  clientContacts: { id: "id", clientId: "client_id", name: "name", phone: "phone", email: "email" },
  clientPositions: { _: "client_positions_table" },
  clientDocuments: { _: "client_documents_table" },
  users: { _: "users_table" },
  auditEvents: { _: "audit_events_table" },
}));

const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const ACTOR_ID = "admin-uuid-1";

const sampleContactRow = {
  id: "contact-uuid-1",
  tenantId: TENANT_ID,
  clientId: "client-uuid-1",
  name: "Juan Pérez",
  phone: "+52 55 1234 5678",
  email: "juan@empresa.com",
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
    returning: vi.fn().mockResolvedValue([sampleContactRow]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };
  return chainable;
}

describe("Client Service — createContact", () => {
  let createContact: typeof import("../service.js").createContact;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createContact = mod.createContact;
  });

  it("crea un contacto con datos válidos", async () => {
    const db = createMockDb();

    const result = await createContact(db as any, TENANT_ID, ACTOR_ID, "client-uuid-1", {
      name: "Juan Pérez",
      phone: "+52 55 1234 5678",
      email: "juan@empresa.com",
    });

    expect(result).toBeDefined();
    expect(result.id).toBe("contact-uuid-1");
    expect(result.name).toBe("Juan Pérez");
    expect(result.email).toBe("juan@empresa.com");
    expect(db.insert).toHaveBeenCalled();
  });
});

describe("Client Service — listContacts", () => {
  let listContacts: typeof import("../service.js").listContacts;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    listContacts = mod.listContacts;
  });

  it("retorna contactos del cliente ordenados por nombre", async () => {
    const db = createMockDb();
    db.orderBy = vi.fn().mockResolvedValue([sampleContactRow]);

    const result = await listContacts(db as any, "client-uuid-1");

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Juan Pérez");
  });

  it("retorna lista vacía cuando no hay contactos", async () => {
    const db = createMockDb();
    db.orderBy = vi.fn().mockResolvedValue([]);

    const result = await listContacts(db as any, "client-uuid-1");

    expect(result).toHaveLength(0);
  });
});

describe("Client Service — updateContact", () => {
  let updateContact: typeof import("../service.js").updateContact;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    updateContact = mod.updateContact;
  });

  it("actualiza campos parciales del contacto", async () => {
    const updatedRow = { ...sampleContactRow, name: "María López" };
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([sampleContactRow]);
    db.returning = vi.fn().mockResolvedValue([updatedRow]);

    const result = await updateContact(db as any, TENANT_ID, ACTOR_ID, "contact-uuid-1", {
      name: "María López",
    });

    expect(result).not.toBeNull();
    expect(result!.name).toBe("María López");
  });

  it("retorna null cuando el contacto no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await updateContact(db as any, TENANT_ID, ACTOR_ID, "nonexistent", {
      name: "No existe",
    });

    expect(result).toBeNull();
  });
});

describe("Client Service — deleteContact", () => {
  let deleteContact: typeof import("../service.js").deleteContact;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    deleteContact = mod.deleteContact;
  });

  it("elimina el contacto cuando existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([sampleContactRow]);
    // delete().where() resuelve directamente
    db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const result = await deleteContact(db as any, TENANT_ID, ACTOR_ID, "contact-uuid-1");

    expect(result).toBe(true);
  });

  it("retorna false cuando el contacto no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await deleteContact(db as any, TENANT_ID, ACTOR_ID, "nonexistent");

    expect(result).toBe(false);
  });
});
