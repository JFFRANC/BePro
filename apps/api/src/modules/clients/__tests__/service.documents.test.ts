import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  clients: { _: "clients_table" },
  clientAssignments: { _: "client_assignments_table" },
  clientContacts: { _: "client_contacts_table" },
  clientPositions: { _: "client_positions_table" },
  clientDocuments: { id: "id", clientId: "client_id", uploadedBy: "uploaded_by", storageKey: "storage_key" },
  users: { id: "id", firstName: "first_name", lastName: "last_name" },
  auditEvents: { _: "audit_events_table" },
}));

const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const ACTOR_ID = "admin-uuid-1";

const sampleDocumentRow = {
  id: "doc-uuid-1",
  tenantId: TENANT_ID,
  clientId: "client-uuid-1",
  originalName: "cotizacion.pdf",
  documentType: "quotation",
  mimeType: "application/pdf",
  sizeBytes: 204800,
  storageKey: "tenants/t1/clients/c1/docs/abc123.pdf",
  uploadedBy: ACTOR_ID,
  createdAt: new Date("2026-04-15T00:00:00Z"),
};

function createMockDb() {
  const chainable: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([sampleDocumentRow]),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };
  return chainable;
}

describe("Client Service — createDocumentRecord", () => {
  let createDocumentRecord: typeof import("../service.js").createDocumentRecord;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createDocumentRecord = mod.createDocumentRecord;
  });

  it("crea un registro de documento en la base de datos", async () => {
    const db = createMockDb();

    const result = await createDocumentRecord(db as any, TENANT_ID, ACTOR_ID, "client-uuid-1", {
      originalName: "cotizacion.pdf",
      documentType: "quotation",
      mimeType: "application/pdf",
      sizeBytes: 204800,
      storageKey: "tenants/t1/clients/c1/docs/abc123.pdf",
    });

    expect(result).toBeDefined();
    expect(result.id).toBe("doc-uuid-1");
    expect(result.originalName).toBe("cotizacion.pdf");
    expect(db.insert).toHaveBeenCalled();
  });
});

describe("Client Service — listDocuments", () => {
  let listDocuments: typeof import("../service.js").listDocuments;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    listDocuments = mod.listDocuments;
  });

  it("retorna documentos con nombre del uploader", async () => {
    const db = createMockDb();
    db.orderBy = vi.fn().mockResolvedValue([
      {
        ...sampleDocumentRow,
        uploaderFirstName: "Admin",
        uploaderLastName: "User",
      },
    ]);

    const result = await listDocuments(db as any, "client-uuid-1");

    expect(result).toHaveLength(1);
    expect(result[0].originalName).toBe("cotizacion.pdf");
    expect(result[0].uploaderName).toBe("Admin User");
    expect(result[0].documentType).toBe("quotation");
  });

  it("retorna lista vacía cuando no hay documentos", async () => {
    const db = createMockDb();
    db.orderBy = vi.fn().mockResolvedValue([]);

    const result = await listDocuments(db as any, "client-uuid-1");

    expect(result).toHaveLength(0);
  });
});

describe("Client Service — getDocumentById", () => {
  let getDocumentById: typeof import("../service.js").getDocumentById;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    getDocumentById = mod.getDocumentById;
  });

  it("retorna el documento cuando existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([sampleDocumentRow]);

    const result = await getDocumentById(db as any, "doc-uuid-1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("doc-uuid-1");
  });

  it("retorna null cuando no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await getDocumentById(db as any, "nonexistent");

    expect(result).toBeNull();
  });
});

describe("Client Service — deleteDocumentRecord", () => {
  let deleteDocumentRecord: typeof import("../service.js").deleteDocumentRecord;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    deleteDocumentRecord = mod.deleteDocumentRecord;
  });

  it("elimina el registro y retorna el documento original", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([sampleDocumentRow]);
    db.delete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const result = await deleteDocumentRecord(db as any, TENANT_ID, ACTOR_ID, "doc-uuid-1");

    expect(result).not.toBeNull();
    expect(result!.storageKey).toBe("tenants/t1/clients/c1/docs/abc123.pdf");
  });

  it("retorna null cuando el documento no existe", async () => {
    const db = createMockDb();
    db.limit = vi.fn().mockResolvedValue([]);

    const result = await deleteDocumentRecord(db as any, TENANT_ID, ACTOR_ID, "nonexistent");

    expect(result).toBeNull();
  });
});
