import { eq, and, or, ilike, sql, count } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
import {
  users,
  refreshTokens,
  clients,
  clientAssignments,
} from "@bepro/db";
import type { Database } from "@bepro/db";
import { recordAuditEvent } from "../../lib/audit.js";
import type { CreateUserParams, ListUsersParams, UpdateUserParams } from "./types.js";
import { bulkImportRowSchema, type IUserDto, type IUserListResponse, type UserRole } from "@bepro/shared";
import type { BulkImportResult } from "./types.js";

const BCRYPT_COST = 12;

/**
 * 010-user-client-assignment — error tipado que el route handler mapea a
 * `400 { error: "cliente inactivo o inexistente" }`. Se lanza cuando el
 * `clientId` enviado no existe / no está activo / pertenece a otro tenant
 * (RLS hace que estos tres casos sean indistinguibles, lo cual es deseable
 * para evitar enumeration leak — Q4 del clarify).
 */
export class ClientNotFoundError extends Error {
  constructor() {
    super("CLIENT_NOT_FOUND");
    this.name = "ClientNotFoundError";
  }
}

function toUserDto(user: typeof users.$inferSelect): IUserDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role as IUserDto["role"],
    isFreelancer: user.isFreelancer,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function createUser(
  db: Database,
  tenantId: string,
  actorId: string,
  params: CreateUserParams,
): Promise<IUserDto | null> {
  // Check email uniqueness within tenant (UNIQUE constraint also enforces this)
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, params.email)));

  if (existing) {
    return null;
  }

  // 010 — Captura de cliente primario. Sólo aplica a AE/recruiter; para
  // admin/manager descartamos cualquier clientId que llegue (defensive no-op,
  // FR-005). El validator Zod ya rechaza AE/recruiter sin clientId, así que
  // aquí confiamos en lo recibido.
  const captureClient =
    (params.role === "account_executive" || params.role === "recruiter") &&
    Boolean(params.clientId);
  const clientId = captureClient ? params.clientId! : undefined;

  // Validamos el cliente ANTES del bcrypt — fail-fast cuando el cliente no
  // existe / está inactivo / es de otro tenant (RLS unifica los tres casos
  // en "0 filas", lo cual nos da el no-enumeration property gratis, Q4).
  if (clientId) {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.isActive, true)));
    if (!client) {
      throw new ClientNotFoundError();
    }
  }

  const passwordHash = await hash(params.password, BCRYPT_COST);

  const [created] = await db
    .insert(users)
    .values({
      tenantId,
      email: params.email,
      passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role,
      isFreelancer: params.isFreelancer,
      mustChangePassword: true,
    })
    .returning();

  // 010 — Inserta la fila en client_assignments en la MISMA transacción que
  // el insert del user (tenantMiddleware envuelve toda la handler en
  // `SET LOCAL app.tenant_id`). accountExecutiveId siempre NULL aquí; pairing
  // recruiter ↔ líder AE se hace después por el flujo batch de 008 (Q3).
  if (clientId) {
    await db.insert(clientAssignments).values({
      tenantId,
      clientId,
      userId: created.id,
      accountExecutiveId: null,
    });
  }

  await recordAuditEvent(db, {
    tenantId,
    actorId,
    action: "user.created",
    targetType: "user",
    targetId: created.id,
    newValues: {
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      role: params.role,
      isFreelancer: params.isFreelancer,
      ...(clientId ? { clientId } : {}),
    },
  });

  return toUserDto(created);
}

export async function listUsers(
  db: Database,
  tenantId: string,
  params: ListUsersParams,
): Promise<IUserListResponse> {
  const { page, limit, search, role, isActive, isFreelancer, currentUser } = params;
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions = [eq(users.tenantId, tenantId)];

  // Role-scoped visibility
  if (currentUser.role === "recruiter") {
    conditions.push(eq(users.id, currentUser.id));
  } else if (currentUser.role === "account_executive") {
    conditions.push(eq(users.role, "recruiter"));
  }

  if (search) {
    conditions.push(
      or(
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName, `%${search}%`),
        ilike(users.email, `%${search}%`),
      )!,
    );
  }

  if (role) {
    conditions.push(eq(users.role, role));
  }

  if (isActive !== undefined) {
    conditions.push(eq(users.isActive, isActive));
  }

  if (isFreelancer !== undefined) {
    conditions.push(eq(users.isFreelancer, isFreelancer));
  }

  const whereClause = and(...conditions);

  // Get total count
  const [countResult] = await db
    .select({ count: count() })
    .from(users)
    .where(whereClause);

  const total = Number(countResult?.count ?? 0);

  // Get paginated results
  const rows = await db
    .select()
    .from(users)
    .where(whereClause)
    .orderBy(users.createdAt)
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map(toUserDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUserById(
  db: Database,
  userId: string,
  currentUser: { id: string; role: UserRole },
): Promise<IUserDto | null> {
  // Recruiter can only see their own profile
  if (currentUser.role === "recruiter" && currentUser.id !== userId) {
    return null;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return null;
  }

  // AE can only see recruiters
  if (currentUser.role === "account_executive" && user.role !== "recruiter") {
    return null;
  }

  return toUserDto(user);
}

export async function updateUser(
  db: Database,
  tenantId: string,
  actorId: string,
  targetUserId: string,
  currentUserRole: UserRole,
  params: UpdateUserParams,
): Promise<IUserDto | null | { error: string }> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!existing) {
    return null;
  }

  // Non-admin can only update self
  if (currentUserRole !== "admin" && actorId !== targetUserId) {
    return { error: "No tienes permisos para editar este usuario" };
  }

  // Non-admin cannot change role or isFreelancer
  if (currentUserRole !== "admin" && (params.role !== undefined || params.isFreelancer !== undefined)) {
    return { error: "Solo un administrador puede cambiar el rol" };
  }

  // Last-admin protection
  if (params.role && existing.role === "admin" && params.role !== "admin") {
    const [result] = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin"), eq(users.isActive, true)));

    if (Number(result?.count ?? 0) <= 1) {
      return { error: "No se puede cambiar el rol del último administrador activo" };
    }
  }

  // Build update object from changed fields
  const updateFields: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  if (params.firstName !== undefined && params.firstName !== existing.firstName) {
    updateFields.firstName = params.firstName;
    oldValues.firstName = existing.firstName;
    newValues.firstName = params.firstName;
  }
  if (params.lastName !== undefined && params.lastName !== existing.lastName) {
    updateFields.lastName = params.lastName;
    oldValues.lastName = existing.lastName;
    newValues.lastName = params.lastName;
  }
  if (params.role !== undefined && params.role !== existing.role) {
    updateFields.role = params.role;
    oldValues.role = existing.role;
    newValues.role = params.role;
  }
  if (params.isFreelancer !== undefined && params.isFreelancer !== existing.isFreelancer) {
    updateFields.isFreelancer = params.isFreelancer;
    oldValues.isFreelancer = existing.isFreelancer;
    newValues.isFreelancer = params.isFreelancer;
  }

  if (Object.keys(updateFields).length === 0) {
    return toUserDto(existing);
  }

  updateFields.updatedAt = new Date();

  const [updated] = await db
    .update(users)
    .set(updateFields)
    .where(eq(users.id, targetUserId))
    .returning();

  const action = params.role !== undefined && params.role !== existing.role
    ? "user.role_changed"
    : "user.updated";

  await recordAuditEvent(db, {
    tenantId,
    actorId,
    action,
    targetType: "user",
    targetId: targetUserId,
    oldValues: Object.keys(oldValues).length > 0 ? oldValues : null,
    newValues: Object.keys(newValues).length > 0 ? newValues : null,
  });

  return toUserDto(updated);
}

const EXPECTED_CSV_HEADERS = ["email", "firstName", "lastName", "role", "isFreelancer"];
const MAX_IMPORT_ROWS = 100;

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((c) => c.trim()));
  return { headers, rows };
}

export async function bulkImportUsers(
  db: Database,
  tenantId: string,
  actorId: string,
  csvText: string,
): Promise<BulkImportResult | { error: string }> {
  if (!csvText.trim()) {
    return { error: "El archivo CSV está vacío" };
  }

  const { headers, rows } = parseCSV(csvText);

  if (
    headers.length !== EXPECTED_CSV_HEADERS.length ||
    !EXPECTED_CSV_HEADERS.every((h, i) => headers[i] === h)
  ) {
    return { error: "El formato del encabezado es inválido" };
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: "El archivo excede el máximo de 100 filas" };
  }

  const results: BulkImportResult["results"] = [];
  const seenEmails = new Set<string>();
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    const rawEmail = row[0] ?? "";

    // Validate row with Zod schema
    const parsed = bulkImportRowSchema.safeParse({
      email: rawEmail,
      firstName: row[1] ?? "",
      lastName: row[2] ?? "",
      role: row[3] ?? "",
      isFreelancer: row[4] ?? "false",
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
      results.push({ row: rowNum, status: "error", email: rawEmail, error: firstError });
      errorCount++;
      continue;
    }

    const { email, firstName, lastName, role, isFreelancer } = parsed.data;

    // Check duplicate within file
    if (seenEmails.has(email)) {
      results.push({ row: rowNum, status: "error", email, error: "Email duplicado en el archivo" });
      errorCount++;
      continue;
    }
    seenEmails.add(email);

    // Check existing in DB
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)));

    if (existing) {
      results.push({ row: rowNum, status: "error", email, error: "El correo electrónico ya está registrado" });
      errorCount++;
      continue;
    }

    // Generate temp password
    const tempPassword = `Bp!${crypto.randomUUID().slice(0, 12)}`;
    const passwordHash = await hash(tempPassword, BCRYPT_COST);

    try {
      const [created] = await db
        .insert(users)
        .values({
          tenantId,
          email,
          passwordHash,
          firstName,
          lastName,
          role,
          isFreelancer,
          mustChangePassword: true,
        })
        .returning();

      await recordAuditEvent(db, {
        tenantId,
        actorId,
        action: "user.created",
        targetType: "user",
        targetId: created.id,
        newValues: { email, firstName, lastName, role, isFreelancer, source: "bulk_import" },
      });

      results.push({ row: rowNum, status: "success", email, temporaryPassword: tempPassword });
      successCount++;
    } catch {
      results.push({ row: rowNum, status: "error", email, error: "Error al crear el usuario" });
      errorCount++;
    }
  }

  return {
    totalRows: rows.length,
    successCount,
    errorCount,
    results,
  };
}

export async function changePassword(
  db: Database,
  tenantId: string,
  actorId: string,
  targetUserId: string,
  params: { currentPassword: string; newPassword: string },
): Promise<{ success: true; user: IUserDto } | { error: string }> {
  if (actorId !== targetUserId) {
    return { error: "Solo puedes cambiar tu propia contraseña" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!user) {
    return { error: "Usuario no encontrado" };
  }

  const valid = await compare(params.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "La contraseña actual es incorrecta" };
  }

  const newHash = await hash(params.newPassword, BCRYPT_COST);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId));

  // Revoke all other refresh tokens (keep current session)
  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.userId, targetUserId));

  await recordAuditEvent(db, {
    tenantId,
    actorId,
    action: "user.password_changed",
    targetType: "user",
    targetId: targetUserId,
    oldValues: null,
    newValues: null,
  });

  return { success: true, user: toUserDto({ ...user, mustChangePassword: false }) };
}

export async function resetPassword(
  db: Database,
  tenantId: string,
  actorId: string,
  targetUserId: string,
  params: { newPassword: string },
): Promise<{ success: true } | { error: string } | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!user) {
    return null;
  }

  const newHash = await hash(params.newPassword, BCRYPT_COST);

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      mustChangePassword: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId));

  // Revoke all refresh tokens
  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.userId, targetUserId));

  await recordAuditEvent(db, {
    tenantId,
    actorId,
    action: "user.password_reset",
    targetType: "user",
    targetId: targetUserId,
    oldValues: null,
    newValues: null,
  });

  return { success: true };
}

export async function deactivateUser(
  db: Database,
  tenantId: string,
  actorId: string,
  targetUserId: string,
): Promise<IUserDto | null | { error: string }> {
  if (actorId === targetUserId) {
    return { error: "No puedes desactivar tu propia cuenta" };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!user) {
    return null;
  }

  // Last-admin protection
  if (user.role === "admin") {
    const [result] = await db
      .select({ count: count() })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, "admin"), eq(users.isActive, true)));

    if (Number(result?.count ?? 0) <= 1) {
      return { error: "No se puede desactivar al último administrador activo" };
    }
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning();

  // Revoke all sessions
  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.userId, targetUserId));

  await recordAuditEvent(db, {
    tenantId,
    actorId,
    action: "user.deactivated",
    targetType: "user",
    targetId: targetUserId,
    oldValues: { isActive: true },
    newValues: { isActive: false },
  });

  return toUserDto(updated);
}

export async function reactivateUser(
  db: Database,
  tenantId: string,
  actorId: string,
  targetUserId: string,
): Promise<IUserDto | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId));

  if (!user) {
    return null;
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, targetUserId))
    .returning();

  await recordAuditEvent(db, {
    tenantId,
    actorId,
    action: "user.reactivated",
    targetType: "user",
    targetId: targetUserId,
    oldValues: { isActive: false },
    newValues: { isActive: true },
  });

  return toUserDto(updated);
}
