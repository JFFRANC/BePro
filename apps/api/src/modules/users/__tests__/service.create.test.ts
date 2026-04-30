import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("$2a$12$hashedpassword"),
}));

vi.mock("../../../lib/audit.js", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@bepro/db", () => ({
  users: { _: "users_table" },
  clients: { _: "clients_table" },
  clientAssignments: { _: "client_assignments_table" },
  auditEvents: { _: "audit_events_table" },
}));

import { hash } from "bcryptjs";
import { recordAuditEvent } from "../../../lib/audit.js";

const TENANT_A = "d9eb10b9-d578-48d7-a70c-5525a9c9eb47";
const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ACTIVE = "1c1c63d9-2b5a-4f7e-9d1a-2cd2af1fbb0e";

interface MockOptions {
  existingUser?: boolean;
  clientFound?: boolean;
}

/**
 * Mock que enruta llamadas según el orden esperado del service:
 *   1. select().from(users).where()           — uniqueness email
 *   2. select().from(clients).where()         — client validation (sólo si clientId presente para AE/recruiter)
 *   3. insert(users).values().returning()     — insert user
 *   4. insert(clientAssignments).values()     — insert assignment (sólo si clientId aplica)
 *
 * Usamos colas separadas para `where` (selects) y trackeamos inserts vía mock.calls.
 */
function createMockDb(options: MockOptions = {}) {
  const { existingUser = false, clientFound = true } = options;

  // Cola de resultados para .where(): primero uniqueness, luego (si aplica) client validation.
  const whereResults: unknown[] = [
    existingUser ? [{ id: "existing-id" }] : [],
    clientFound ? [{ id: CLIENT_ACTIVE }] : [],
  ];

  const insertCalls: { table: { _: string }; values: unknown }[] = [];
  let lastInsertTable: { _: string } | null = null;

  const chainable: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(() => Promise.resolve(whereResults.shift() ?? [])),
    insert: vi.fn((table: { _: string }) => {
      lastInsertTable = table;
      return chainable;
    }),
    values: vi.fn((value: unknown) => {
      insertCalls.push({ table: lastInsertTable!, values: value });
      return chainable;
    }),
    returning: vi.fn().mockResolvedValue([
      {
        id: "new-user-uuid",
        tenantId: TENANT_A,
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
    _insertCalls: insertCalls,
  };

  return chainable;
}

describe("createUser service — base behavior", () => {
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
    clientId: CLIENT_ACTIVE,
  };

  it("creates a user with hashed password and mustChangePassword true", async () => {
    const db = createMockDb();
    const result = await createUser(db as any, TENANT_A, ADMIN_ID, validParams);
    expect(result).not.toBeNull();
    expect(result!.mustChangePassword).toBe(true);
    expect(result!.email).toBe("new@example.com");
    expect(hash).toHaveBeenCalledWith("SecurePass123", 12);
  });

  it("returns null (409) when email already exists in tenant", async () => {
    const db = createMockDb({ existingUser: true });
    const result = await createUser(db as any, TENANT_A, ADMIN_ID, validParams);
    expect(result).toBeNull();
  });

  it("hashes password with bcrypt cost 12", async () => {
    const db = createMockDb();
    await createUser(db as any, TENANT_A, ADMIN_ID, validParams);
    expect(hash).toHaveBeenCalledWith("SecurePass123", 12);
  });

  it("records an audit event after creation", async () => {
    const db = createMockDb();
    await createUser(db as any, TENANT_A, ADMIN_ID, validParams);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT_A,
        actorId: ADMIN_ID,
        action: "user.created",
        targetType: "user",
        targetId: "new-user-uuid",
      }),
    );
  });

  it("sets mustChangePassword to true on new user", async () => {
    const db = createMockDb();
    await createUser(db as any, TENANT_A, ADMIN_ID, validParams);
    const userInsert = (db as any)._insertCalls.find(
      (c: any) => c.table._ === "users_table",
    );
    expect(userInsert.values.mustChangePassword).toBe(true);
  });
});

describe("createUser service — 010 client assignment (US1)", () => {
  let createUser: typeof import("../service.js").createUser;
  let ClientNotFoundError: typeof import("../service.js").ClientNotFoundError;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../service.js");
    createUser = mod.createUser;
    ClientNotFoundError = mod.ClientNotFoundError;
  });

  const baseParams = {
    email: "ae@example.com",
    password: "SecurePass123",
    firstName: "Ana",
    lastName: "López",
    isFreelancer: false,
  };

  it("inserts a client_assignments row when role=account_executive + valid clientId", async () => {
    const db = createMockDb({ clientFound: true });
    await createUser(db as any, TENANT_A, ADMIN_ID, {
      ...baseParams,
      role: "account_executive",
      clientId: CLIENT_ACTIVE,
    });

    const assignmentInsert = (db as any)._insertCalls.find(
      (c: any) => c.table._ === "client_assignments_table",
    );
    expect(assignmentInsert).toBeDefined();
    expect(assignmentInsert.values).toMatchObject({
      tenantId: TENANT_A,
      clientId: CLIENT_ACTIVE,
      userId: "new-user-uuid",
      accountExecutiveId: null,
    });
  });

  it("inserts a client_assignments row when role=recruiter + valid clientId", async () => {
    const db = createMockDb({ clientFound: true });
    await createUser(db as any, TENANT_A, ADMIN_ID, {
      ...baseParams,
      role: "recruiter",
      clientId: CLIENT_ACTIVE,
    });
    const assignmentInsert = (db as any)._insertCalls.find(
      (c: any) => c.table._ === "client_assignments_table",
    );
    expect(assignmentInsert).toBeDefined();
    expect(assignmentInsert.values.accountExecutiveId).toBeNull();
  });

  it("throws ClientNotFoundError when clientId provided but client not found / inactive (AE)", async () => {
    const db = createMockDb({ clientFound: false });
    await expect(
      createUser(db as any, TENANT_A, ADMIN_ID, {
        ...baseParams,
        role: "account_executive",
        clientId: CLIENT_ACTIVE,
      }),
    ).rejects.toBeInstanceOf(ClientNotFoundError);
  });

  it("throws ClientNotFoundError when clientId provided but client not found / inactive (recruiter)", async () => {
    const db = createMockDb({ clientFound: false });
    await expect(
      createUser(db as any, TENANT_A, ADMIN_ID, {
        ...baseParams,
        role: "recruiter",
        clientId: CLIENT_ACTIVE,
      }),
    ).rejects.toBeInstanceOf(ClientNotFoundError);
  });

  it("does NOT insert client_assignments row when role=admin even with stray clientId (defensive no-op)", async () => {
    const db = createMockDb({ clientFound: true });
    await createUser(db as any, TENANT_A, ADMIN_ID, {
      ...baseParams,
      role: "admin",
      clientId: CLIENT_ACTIVE,
    });
    const assignmentInsert = (db as any)._insertCalls.find(
      (c: any) => c.table._ === "client_assignments_table",
    );
    expect(assignmentInsert).toBeUndefined();
  });

  it("does NOT insert client_assignments row when role=manager even with stray clientId (defensive no-op)", async () => {
    const db = createMockDb({ clientFound: true });
    await createUser(db as any, TENANT_A, ADMIN_ID, {
      ...baseParams,
      role: "manager",
      clientId: CLIENT_ACTIVE,
    });
    const assignmentInsert = (db as any)._insertCalls.find(
      (c: any) => c.table._ === "client_assignments_table",
    );
    expect(assignmentInsert).toBeUndefined();
  });

  it("does NOT validate the client when role=admin (saves a SELECT)", async () => {
    // Si el service validara para admin/manager, consumiría el segundo where()
    // y dejaría la cola vacía; verificamos que NO se haga la validación.
    const db = createMockDb({ clientFound: false });
    // clientFound=false haría tirar ClientNotFoundError si llegara a validar
    await expect(
      createUser(db as any, TENANT_A, ADMIN_ID, {
        ...baseParams,
        role: "admin",
        clientId: CLIENT_ACTIVE,
      }),
    ).resolves.not.toBeNull();
  });

  it("audit newValues includes clientId when captured (recruiter + valid client)", async () => {
    const db = createMockDb({ clientFound: true });
    await createUser(db as any, TENANT_A, ADMIN_ID, {
      ...baseParams,
      role: "recruiter",
      clientId: CLIENT_ACTIVE,
    });
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "user.created",
        newValues: expect.objectContaining({ clientId: CLIENT_ACTIVE }),
      }),
    );
  });

  it("audit newValues OMITS clientId when no client captured (admin)", async () => {
    const db = createMockDb({ clientFound: true });
    await createUser(db as any, TENANT_A, ADMIN_ID, {
      ...baseParams,
      role: "admin",
    });
    const call = vi.mocked(recordAuditEvent).mock.calls.at(-1)!;
    const event = call[1] as { newValues: Record<string, unknown> };
    expect(event.newValues.clientId).toBeUndefined();
  });

  it("audit newValues OMITS clientId when role=admin even with stray clientId (defensive)", async () => {
    const db = createMockDb({ clientFound: true });
    await createUser(db as any, TENANT_A, ADMIN_ID, {
      ...baseParams,
      role: "admin",
      clientId: CLIENT_ACTIVE,
    });
    const call = vi.mocked(recordAuditEvent).mock.calls.at(-1)!;
    const event = call[1] as { newValues: Record<string, unknown> };
    expect(event.newValues.clientId).toBeUndefined();
  });
});
