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

import { recordAuditEvent } from "../../../lib/audit.js";

const baseMockUser = {
  id: "user-uuid-1",
  tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
  email: "user@test.com",
  passwordHash: "$2a$12$hashed",
  firstName: "Juan",
  lastName: "Pérez",
  role: "recruiter",
  isFreelancer: false,
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  failedLoginCount: 0,
  firstFailedAt: null,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockDb(options: {
  user?: typeof baseMockUser | null;
  activeAdminCount?: number;
} = {}) {
  const { user = baseMockUser, activeAdminCount = 2 } = options;
  let selectCallCount = 0;
  let isUpdateChain = false;

  const chainable: Record<string, any> = {
    select: vi.fn().mockImplementation(() => {
      selectCallCount++;
      isUpdateChain = false;
      return chainable;
    }),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      if (isUpdateChain) {
        // Update chain: update().set().where() — needs to stay chainable for .returning()
        return chainable;
      }
      if (selectCallCount === 1) {
        return Promise.resolve(user ? [user] : []);
      }
      if (selectCallCount === 2) {
        return Object.assign(Promise.resolve([{ count: activeAdminCount }]), chainable);
      }
      return Promise.resolve([]);
    }),
    update: vi.fn().mockImplementation(() => {
      isUpdateChain = true;
      return chainable;
    }),
    set: vi.fn().mockImplementation((values: any) => {
      chainable._lastSet = values;
      return chainable;
    }),
    returning: vi.fn().mockImplementation(() => {
      const updatedUser = { ...baseMockUser, ...chainable._lastSet };
      return Promise.resolve([updatedUser]);
    }),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    _lastSet: {},
  };

  return chainable;
}

describe("updateUser service", () => {
  let updateUser: typeof import("../service.js").updateUser;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    updateUser = mod.updateUser;
  });

  it("updates firstName and lastName successfully", async () => {
    const db = createMockDb();

    const result = await updateUser(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", "user-uuid-1", "admin",
      { firstName: "Carlos", lastName: "López" },
    );

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("error");
  });

  it("returns null when user not found", async () => {
    const db = createMockDb({ user: null });

    const result = await updateUser(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", "nonexistent", "admin",
      { firstName: "Test" },
    );

    expect(result).toBeNull();
  });

  it("non-admin can update own name fields", async () => {
    const db = createMockDb();

    const result = await updateUser(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "user-uuid-1", "user-uuid-1", "recruiter",
      { firstName: "Carlos" },
    );

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("error");
  });

  it("non-admin cannot update another user", async () => {
    const db = createMockDb();

    const result = await updateUser(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "other-user", "user-uuid-1", "recruiter",
      { firstName: "Carlos" },
    );

    expect(result).toHaveProperty("error");
  });

  it("non-admin cannot change role", async () => {
    const db = createMockDb();

    const result = await updateUser(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "user-uuid-1", "user-uuid-1", "recruiter",
      { role: "admin" },
    );

    expect(result).toHaveProperty("error");
  });

  it("non-admin cannot change isFreelancer", async () => {
    const db = createMockDb();

    const result = await updateUser(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "user-uuid-1", "user-uuid-1", "recruiter",
      { isFreelancer: true },
    );

    expect(result).toHaveProperty("error");
  });

  it("blocks role change for last admin", async () => {
    const adminUser = { ...baseMockUser, role: "admin" };
    const db = createMockDb({ user: adminUser, activeAdminCount: 1 });

    const result = await updateUser(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", "user-uuid-1", "admin",
      { role: "recruiter" },
    );

    expect(result).toHaveProperty("error");
    expect((result as any).error).toContain("último administrador");
  });

  it("records audit event with old/new values", async () => {
    const db = createMockDb();

    await updateUser(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", "user-uuid-1", "admin",
      { firstName: "Carlos" },
    );

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "user.updated",
        targetType: "user",
        targetId: "user-uuid-1",
      }),
    );
  });
});
