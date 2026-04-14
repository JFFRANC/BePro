import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  users: { _: "users_table" },
  auditEvents: { _: "audit_events_table" },
}));

vi.mock("../../../lib/audit.js", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2a$12$hashed"),
}));

vi.stubGlobal("crypto", {
  ...globalThis.crypto,
  randomUUID: vi.fn().mockReturnValue("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
});

function createMockDb(options: { existingEmails?: string[] } = {}) {
  const { existingEmails = [] } = options;

  const chainable: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      // Check if email exists
      return Promise.resolve([]);
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(() => {
      return Promise.resolve([{
        id: "new-user-uuid",
        tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
        email: "import@test.com",
        firstName: "Test",
        lastName: "User",
        role: "recruiter",
        isFreelancer: false,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);
    }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  return chainable;
}

describe("bulkImportUsers service", () => {
  let bulkImportUsers: typeof import("../service.js").bulkImportUsers;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    bulkImportUsers = mod.bulkImportUsers;
  });

  const validCsv = `email,firstName,lastName,role,isFreelancer
maria@test.com,María,García,recruiter,false
juan@test.com,Juan,Pérez,recruiter,true`;

  it("imports valid CSV rows successfully", async () => {
    const db = createMockDb();

    const result = await bulkImportUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", validCsv);

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.totalRows).toBe(2);
      expect(result.successCount).toBeGreaterThan(0);
      expect(result.results.length).toBe(2);
    }
  });

  it("returns error for empty CSV", async () => {
    const db = createMockDb();

    const result = await bulkImportUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", "");

    expect(result).toHaveProperty("error");
  });

  it("returns error for invalid headers", async () => {
    const db = createMockDb();
    const badCsv = `name,surname,email\nJuan,Pérez,j@test.com`;

    const result = await bulkImportUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", badCsv);

    expect(result).toHaveProperty("error");
  });

  it("returns error when exceeding 100 rows", async () => {
    const db = createMockDb();
    const header = "email,firstName,lastName,role,isFreelancer\n";
    const rows = Array.from({ length: 101 }, (_, i) =>
      `user${i}@test.com,Name${i},Last${i},recruiter,false`
    ).join("\n");

    const result = await bulkImportUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", header + rows);

    expect(result).toHaveProperty("error");
  });

  it("generates temporary passwords with Bp! prefix", async () => {
    const db = createMockDb();

    const result = await bulkImportUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", validCsv);

    if ("results" in result) {
      const successRow = result.results.find((r) => r.status === "success");
      expect(successRow?.temporaryPassword).toMatch(/^Bp!/);
    }
  });

  it("handles duplicate emails within file (first wins)", async () => {
    const db = createMockDb();
    const dupCsv = `email,firstName,lastName,role,isFreelancer
dup@test.com,First,User,recruiter,false
dup@test.com,Second,User,recruiter,false`;

    const result = await bulkImportUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", dupCsv);

    if ("results" in result) {
      const dupRows = result.results.filter((r) => r.email === "dup@test.com");
      expect(dupRows[0].status).toBe("success");
      expect(dupRows[1].status).toBe("error");
    }
  });
});
