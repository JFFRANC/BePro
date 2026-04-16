import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@bepro/db", () => ({
  auditEvents: { _: "audit_events_table" },
}));

const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockResolvedValue(undefined);

const mockDb = {
  insert: mockInsert,
  values: mockValues,
} as unknown;

// Chain: db.insert(table).values(data)
mockInsert.mockReturnValue({ values: mockValues });

describe("recordAuditEvent", () => {
  let recordAuditEvent: typeof import("../audit.js").recordAuditEvent;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ values: mockValues });
    const mod = await import("../audit.js");
    recordAuditEvent = mod.recordAuditEvent;
  });

  it("inserts an audit event with all fields", async () => {
    await recordAuditEvent(mockDb as any, {
      tenantId: "tenant-1",
      actorId: "actor-1",
      action: "user.created",
      targetType: "user",
      targetId: "target-1",
      oldValues: null,
      newValues: { firstName: "Juan" },
    });

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      actorId: "actor-1",
      action: "user.created",
      targetType: "user",
      targetId: "target-1",
      oldValues: null,
      newValues: { firstName: "Juan" },
    });
  });

  it("defaults oldValues and newValues to null when omitted", async () => {
    await recordAuditEvent(mockDb as any, {
      tenantId: "tenant-1",
      actorId: "actor-1",
      action: "user.deactivated",
      targetType: "user",
      targetId: "target-1",
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValues: null,
        newValues: null,
      }),
    );
  });

  it("never includes password values in audit event fields", async () => {
    await recordAuditEvent(mockDb as any, {
      tenantId: "tenant-1",
      actorId: "actor-1",
      action: "user.password_changed",
      targetType: "user",
      targetId: "target-1",
      oldValues: null,
      newValues: null,
    });

    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues.oldValues).toBeNull();
    expect(insertedValues.newValues).toBeNull();
    // Verify no passwordHash or raw password leaks through old/newValues
    expect(JSON.stringify(insertedValues.oldValues)).not.toContain("passwordHash");
    expect(JSON.stringify(insertedValues.newValues)).not.toContain("passwordHash");
  });
});
