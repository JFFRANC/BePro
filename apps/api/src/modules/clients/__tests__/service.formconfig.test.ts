import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  clients: { id: "id", tenantId: "tenant_id", name: "name", isActive: "is_active", formConfig: "form_config" },
  clientAssignments: { _: "client_assignments_table" },
  clientContacts: { _: "client_contacts_table" },
  clientPositions: { _: "client_positions_table" },
  clientDocuments: { _: "client_documents_table" },
  users: { _: "users_table" },
  auditEvents: { _: "audit_events_table" },
}));

const TENANT_ID = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const ACTOR_ID = "admin-uuid-1";

const sampleClientRow = {
  id: "client-uuid-1",
  tenantId: TENANT_ID,
  name: "Empresa ABC",
  email: null,
  phone: null,
  address: null,
  latitude: null,
  longitude: null,
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

function createMockDb() {
  const chainable: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([sampleClientRow]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([sampleClientRow]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return chainable;
}

describe("Client Service — formConfig update", () => {
  let updateClient: typeof import("../service.js").updateClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    updateClient = mod.updateClient;
  });

  it("actualiza formConfig completo", async () => {
    const newConfig = {
      showInterviewTime: true,
      showPosition: true,
      showMunicipality: false,
      showAge: true,
      showShift: false,
      showPlant: false,
      showInterviewPoint: false,
      showComments: true,
    };
    const updatedRow = { ...sampleClientRow, formConfig: newConfig };
    const db = createMockDb();
    db.returning = vi.fn().mockResolvedValue([updatedRow]);

    const result = await updateClient(db as any, TENANT_ID, ACTOR_ID, "client-uuid-1", {
      formConfig: newConfig,
    });

    expect(result).not.toBeNull();
    expect(result!.formConfig.showInterviewTime).toBe(true);
    expect(result!.formConfig.showPosition).toBe(true);
    expect(result!.formConfig.showComments).toBe(true);
    expect(result!.formConfig.showMunicipality).toBe(false);
    expect(db.update).toHaveBeenCalled();
  });

  it("permite actualizar formConfig junto con otros campos", async () => {
    const newConfig = { ...sampleClientRow.formConfig, showAge: true };
    const updatedRow = { ...sampleClientRow, name: "Nuevo", formConfig: newConfig };
    const db = createMockDb();
    db.returning = vi.fn().mockResolvedValue([updatedRow]);

    const result = await updateClient(db as any, TENANT_ID, ACTOR_ID, "client-uuid-1", {
      name: "Nuevo",
      formConfig: newConfig,
    });

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Nuevo");
    expect(result!.formConfig.showAge).toBe(true);
  });
});
