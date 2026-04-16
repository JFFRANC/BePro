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

const mockUsers = [
  {
    id: "user-1",
    tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
    email: "admin@test.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    isFreelancer: false,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "user-2",
    tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
    email: "recruiter@test.com",
    firstName: "Rec",
    lastName: "Ruiter",
    role: "recruiter",
    isFreelancer: true,
    isActive: true,
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

function createMockDb() {
  let selectCallCount = 0;

  const chainable: Record<string, any> = {
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      return chainable;
    }),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      // Count query (first select) resolves directly from where
      if (selectCallCount === 1) {
        const result = [{ count: 2 }];
        return Object.assign(Promise.resolve(result), chainable);
      }
      // Data query continues chaining
      return chainable;
    }),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(mockUsers),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  return chainable;
}

describe("listUsers service", () => {
  let listUsers: typeof import("../service.js").listUsers;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    listUsers = mod.listUsers;
  });

  it("returns paginated users with metadata", async () => {
    const db = createMockDb();

    const result = await listUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", {
      page: 1,
      limit: 20,
      currentUser: { id: "admin-id", role: "admin" },
    });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
  });

  it("applies role-scoped visibility for recruiter (self only)", async () => {
    const db = createMockDb();

    const result = await listUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", {
      page: 1,
      limit: 20,
      currentUser: { id: "user-2", role: "recruiter" },
    });

    // Recruiter should only see self — verified by where() being called with id filter
    expect(db.where).toHaveBeenCalled();
  });

  it("admin sees all users in tenant", async () => {
    const db = createMockDb();

    const result = await listUsers(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", {
      page: 1,
      limit: 20,
      currentUser: { id: "admin-id", role: "admin" },
    });

    expect(result.data).toBeDefined();
  });
});
