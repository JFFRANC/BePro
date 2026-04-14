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

const mockUser = {
  id: "user-uuid-1",
  tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
  email: "user@test.com",
  firstName: "Juan",
  lastName: "Pérez",
  role: "recruiter",
  isFreelancer: false,
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockDb(user: typeof mockUser | null = mockUser) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(user ? [user] : []),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  return chainable;
}

describe("getUserById service", () => {
  let getUserById: typeof import("../service.js").getUserById;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    getUserById = mod.getUserById;
  });

  it("returns user when found", async () => {
    const db = createMockDb();

    const result = await getUserById(db as any, "user-uuid-1", {
      id: "admin-id",
      role: "admin",
    });

    expect(result).not.toBeNull();
    expect(result!.id).toBe("user-uuid-1");
    expect(result!.email).toBe("user@test.com");
  });

  it("returns null when user not found", async () => {
    const db = createMockDb(null);

    const result = await getUserById(db as any, "nonexistent", {
      id: "admin-id",
      role: "admin",
    });

    expect(result).toBeNull();
  });

  it("recruiter can only see their own profile", async () => {
    const db = createMockDb();

    // Recruiter trying to see another user
    const result = await getUserById(db as any, "user-uuid-1", {
      id: "different-user",
      role: "recruiter",
    });

    expect(result).toBeNull();
  });

  it("recruiter can see their own profile", async () => {
    const db = createMockDb();

    const result = await getUserById(db as any, "user-uuid-1", {
      id: "user-uuid-1",
      role: "recruiter",
    });

    expect(result).not.toBeNull();
  });

  it("account_executive can see recruiters", async () => {
    const db = createMockDb();

    const result = await getUserById(db as any, "user-uuid-1", {
      id: "ae-id",
      role: "account_executive",
    });

    // Should return user since they're a recruiter
    expect(result).not.toBeNull();
  });

  it("account_executive cannot see admins", async () => {
    const adminUser = { ...mockUser, role: "admin" };
    const db = createMockDb(adminUser);

    const result = await getUserById(db as any, "user-uuid-1", {
      id: "ae-id",
      role: "account_executive",
    });

    expect(result).toBeNull();
  });
});
