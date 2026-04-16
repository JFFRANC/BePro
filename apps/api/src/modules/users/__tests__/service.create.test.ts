import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2a$12$hashedpassword"),
}));

vi.mock("../../../lib/audit.js", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@bepro/db", () => ({
  users: { _: "users_table" },
  auditEvents: { _: "audit_events_table" },
}));

import { hash } from "bcryptjs";
import { recordAuditEvent } from "../../../lib/audit.js";

function createMockDb(options: { existingUser?: boolean } = {}) {
  const { existingUser = false } = options;

  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(existingUser ? [{ id: "existing-id" }] : []),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([
      {
        id: "new-user-uuid",
        tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
        email: "new@example.com",
        firstName: "María",
        lastName: "García",
        role: "recruiter",
        isFreelancer: false,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  return chainable;
}

describe("createUser service", () => {
  let createUser: typeof import("../service.js").createUser;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createUser = mod.createUser;
  });

  const validParams = {
    email: "new@example.com",
    password: "SecurePass123",
    firstName: "María",
    lastName: "García",
    role: "recruiter" as const,
    isFreelancer: false,
  };

  it("creates a user with hashed password and mustChangePassword true", async () => {
    const db = createMockDb();

    const result = await createUser(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", validParams);

    expect(result).not.toBeNull();
    expect(result!.mustChangePassword).toBe(true);
    expect(result!.email).toBe("new@example.com");
    expect(hash).toHaveBeenCalledWith("SecurePass123", 12);
  });

  it("returns null (409) when email already exists in tenant", async () => {
    const db = createMockDb({ existingUser: true });

    const result = await createUser(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", validParams);

    expect(result).toBeNull();
  });

  it("hashes password with bcrypt cost 12", async () => {
    const db = createMockDb();

    await createUser(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", validParams);

    expect(hash).toHaveBeenCalledWith("SecurePass123", 12);
  });

  it("records an audit event after creation", async () => {
    const db = createMockDb();

    await createUser(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", validParams);

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
        actorId: "admin-uuid",
        action: "user.created",
        targetType: "user",
        targetId: "new-user-uuid",
      }),
    );
  });

  it("sets mustChangePassword to true on new user", async () => {
    const db = createMockDb();

    await createUser(db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "admin-uuid", validParams);

    const insertValues = db.values.mock.calls[0][0];
    expect(insertValues.mustChangePassword).toBe(true);
  });
});
