import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  users: { _: "users_table" },
  refreshTokens: { _: "refresh_tokens_table" },
  auditEvents: { _: "audit_events_table" },
}));

vi.mock("../../../lib/audit.js", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("bcryptjs", () => ({
  compare: vi.fn(),
  hash: vi.fn().mockResolvedValue("$2a$12$newhashed"),
}));

import { compare } from "bcryptjs";
import { recordAuditEvent } from "../../../lib/audit.js";

const mockUser = {
  id: "user-uuid-1",
  tenantId: "d9eb10b9-d578-48d7-a70c-5525a9c9eb47",
  email: "user@test.com",
  passwordHash: "$2a$12$oldhash",
  firstName: "Juan",
  lastName: "Pérez",
  role: "recruiter",
  isFreelancer: false,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: null,
  failedLoginCount: 0,
  firstFailedAt: null,
  lockedUntil: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockDb(user: typeof mockUser | null = mockUser) {
  let isUpdateChain = false;

  const chainable: Record<string, any> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      if (isUpdateChain) return chainable;
      return Promise.resolve(user ? [user] : []);
    }),
    update: vi.fn().mockImplementation(() => {
      isUpdateChain = true;
      return chainable;
    }),
    set: vi.fn().mockImplementation(() => {
      isUpdateChain = false;
      return chainable;
    }),
    returning: vi.fn().mockResolvedValue([{ ...mockUser, mustChangePassword: false }]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  };

  return chainable;
}

describe("changePassword service", () => {
  let changePassword: typeof import("../service.js").changePassword;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    changePassword = mod.changePassword;
  });

  it("changes password successfully with correct current password", async () => {
    const db = createMockDb();
    vi.mocked(compare).mockResolvedValue(true as never);

    const result = await changePassword(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "user-uuid-1", "user-uuid-1",
      { currentPassword: "OldPass123", newPassword: "NewPass456" },
    );

    expect(result).not.toHaveProperty("error");
    expect(result).toHaveProperty("success", true);
    expect(result).toHaveProperty("user");
  });

  it("returns error for wrong current password", async () => {
    const db = createMockDb();
    vi.mocked(compare).mockResolvedValue(false as never);

    const result = await changePassword(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "user-uuid-1", "user-uuid-1",
      { currentPassword: "WrongPass", newPassword: "NewPass456" },
    );

    expect(result).toHaveProperty("error");
  });

  it("returns error when user tries to change another user's password", async () => {
    const db = createMockDb();

    const result = await changePassword(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "other-user", "user-uuid-1",
      { currentPassword: "Pass123", newPassword: "NewPass456" },
    );

    expect(result).toHaveProperty("error");
  });

  it("clears mustChangePassword flag", async () => {
    const db = createMockDb();
    vi.mocked(compare).mockResolvedValue(true as never);

    await changePassword(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "user-uuid-1", "user-uuid-1",
      { currentPassword: "OldPass123", newPassword: "NewPass456" },
    );

    const setCalls = db.set.mock.calls;
    const passwordUpdate = setCalls.find((c: any[]) => c[0]?.mustChangePassword !== undefined);
    expect(passwordUpdate?.[0]?.mustChangePassword).toBe(false);
  });

  it("records audit event without password values", async () => {
    const db = createMockDb();
    vi.mocked(compare).mockResolvedValue(true as never);

    await changePassword(
      db as any, "d9eb10b9-d578-48d7-a70c-5525a9c9eb47", "user-uuid-1", "user-uuid-1",
      { currentPassword: "OldPass123", newPassword: "NewPass456" },
    );

    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "user.password_changed",
        oldValues: null,
        newValues: null,
      }),
    );
  });
});
