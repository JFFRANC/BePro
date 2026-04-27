import { eq, and, ilike, sql, count, inArray } from "drizzle-orm";
import type { Database } from "@bepro/db";
import {
  clients,
  clientAssignments,
  clientContacts,
  clientPositions,
  clientDocuments,
  users,
  auditEvents,
} from "@bepro/db";
import type { IClientFormConfig, IClientDto, IClientContactDto, IClientPositionDto, IClientDocumentDto, IClientAssignmentDto } from "@bepro/shared";
import type { CreateClientInput, UpdateClientInput, ListClientsInput } from "./types.js";

// -- Helpers --

const DEFAULT_FORM_CONFIG: IClientFormConfig = {
  showInterviewTime: false,
  showPosition: false,
  showMunicipality: false,
  showAge: false,
  showShift: false,
  showPlant: false,
  showInterviewPoint: false,
  showComments: false,
};

function toClientDto(row: typeof clients.$inferSelect): IClientDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    latitude: row.latitude ? Number(row.latitude) : undefined,
    longitude: row.longitude ? Number(row.longitude) : undefined,
    isActive: row.isActive,
    formConfig: (row.formConfig as IClientFormConfig) ?? DEFAULT_FORM_CONFIG,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toContactDto(row: typeof clientContacts.$inferSelect): IClientContactDto {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPositionDto(row: typeof clientPositions.$inferSelect): IClientPositionDto {
  return {
    id: row.id,
    clientId: row.clientId,
    name: row.name,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function createAuditEvent(
  db: Database,
  tenantId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  oldValues?: unknown,
  newValues?: unknown,
) {
  await db.insert(auditEvents).values({
    tenantId,
    actorId,
    action,
    targetType,
    targetId,
    oldValues: oldValues ?? null,
    newValues: newValues ?? null,
  });
}

// -- Access verification --

export async function verifyClientAccess(
  db: Database,
  userId: string,
  userRole: string,
  clientId: string,
): Promise<boolean> {
  if (userRole === "admin" || userRole === "manager") {
    return true;
  }

  const [assignment] = await db
    .select({ id: clientAssignments.id })
    .from(clientAssignments)
    .where(
      and(
        eq(clientAssignments.clientId, clientId),
        eq(clientAssignments.userId, userId),
      ),
    )
    .limit(1);

  return !!assignment;
}

export async function verifyClientWriteAccess(
  db: Database,
  userId: string,
  userRole: string,
  clientId: string,
): Promise<boolean> {
  if (userRole === "admin") {
    return true;
  }

  if (userRole === "account_executive") {
    const [assignment] = await db
      .select({ id: clientAssignments.id })
      .from(clientAssignments)
      .where(
        and(
          eq(clientAssignments.clientId, clientId),
          eq(clientAssignments.userId, userId),
        ),
      )
      .limit(1);
    return !!assignment;
  }

  return false;
}

// -- Client CRUD --

export async function createClient(
  db: Database,
  tenantId: string,
  actorId: string,
  input: CreateClientInput,
) {
  const formConfig = input.formConfig ?? DEFAULT_FORM_CONFIG;

  const [created] = await db
    .insert(clients)
    .values({
      tenantId,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address ?? null,
      latitude: input.latitude?.toString() ?? null,
      longitude: input.longitude?.toString() ?? null,
      formConfig,
    })
    .returning();

  await createAuditEvent(db, tenantId, actorId, "create", "client", created.id, null, {
    name: input.name,
  });

  return toClientDto(created);
}

export async function listClients(
  db: Database,
  userId: string,
  userRole: string,
  input: ListClientsInput,
) {
  const { page, limit, search, isActive } = input;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (search) {
    conditions.push(ilike(clients.name, `%${search}%`));
  }
  if (isActive !== undefined) {
    conditions.push(eq(clients.isActive, isActive));
  }

  const needsAssignmentFilter =
    userRole === "account_executive" || userRole === "recruiter";

  if (needsAssignmentFilter) {
    // Subquery: IDs de clientes asignados al usuario
    const assignedClientIds = db
      .select({ clientId: clientAssignments.clientId })
      .from(clientAssignments)
      .where(eq(clientAssignments.userId, userId));

    conditions.push(sql`${clients.id} IN (${assignedClientIds})`);
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ value: count() })
    .from(clients)
    .where(whereClause);

  const total = Number(totalResult.value);

  const rows = await db
    .select()
    .from(clients)
    .where(whereClause)
    .orderBy(clients.name)
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map(toClientDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getClientById(db: Database, clientId: string) {
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!row) return null;
  return toClientDto(row);
}

export async function updateClient(
  db: Database,
  tenantId: string,
  actorId: string,
  clientId: string,
  input: UpdateClientInput,
) {
  const [existing] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!existing) return null;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.email !== undefined) updateData.email = input.email || null;
  if (input.phone !== undefined) updateData.phone = input.phone || null;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.latitude !== undefined)
    updateData.latitude = input.latitude?.toString() ?? null;
  if (input.longitude !== undefined)
    updateData.longitude = input.longitude?.toString() ?? null;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  if (input.formConfig !== undefined) updateData.formConfig = input.formConfig;

  const [updated] = await db
    .update(clients)
    .set(updateData)
    .where(eq(clients.id, clientId))
    .returning();

  await createAuditEvent(
    db,
    tenantId,
    actorId,
    "update",
    "client",
    clientId,
    { name: existing.name, isActive: existing.isActive },
    { name: updated.name, isActive: updated.isActive },
  );

  return toClientDto(updated);
}

// -- Assignments --

export async function createAssignment(
  db: Database,
  tenantId: string,
  actorId: string,
  clientId: string,
  userId: string,
  accountExecutiveId?: string,
) {
  // Verificar que el usuario esté activo
  const [user] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new Error("USER_INACTIVE");
  }

  // Verificar que no esté ya asignado
  const [existing] = await db
    .select({ id: clientAssignments.id })
    .from(clientAssignments)
    .where(
      and(
        eq(clientAssignments.clientId, clientId),
        eq(clientAssignments.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error("ALREADY_ASSIGNED");
  }

  const [created] = await db
    .insert(clientAssignments)
    .values({
      tenantId,
      clientId,
      userId,
      accountExecutiveId: accountExecutiveId ?? null,
    })
    .returning();

  await createAuditEvent(db, tenantId, actorId, "create", "client_assignment", created.id, null, {
    clientId,
    userId,
    accountExecutiveId,
  });

  return created;
}

export async function listAssignments(db: Database, clientId: string) {
  const assignedUser = {
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    role: users.role,
  };

  const rows = await db
    .select({
      id: clientAssignments.id,
      clientId: clientAssignments.clientId,
      userId: clientAssignments.userId,
      accountExecutiveId: clientAssignments.accountExecutiveId,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userRole: users.role,
    })
    .from(clientAssignments)
    .innerJoin(users, eq(clientAssignments.userId, users.id))
    .where(eq(clientAssignments.clientId, clientId));

  // Obtener nombres de clientes y AEs
  const [client] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const clientName = client?.name ?? "";

  const result: IClientAssignmentDto[] = [];
  for (const row of rows) {
    let aeFullName: string | undefined;
    if (row.accountExecutiveId) {
      const [ae] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, row.accountExecutiveId))
        .limit(1);
      if (ae) aeFullName = `${ae.firstName} ${ae.lastName}`;
    }

    result.push({
      id: row.id,
      clientId: row.clientId,
      clientName,
      userId: row.userId,
      userFullName: `${row.userFirstName} ${row.userLastName}`,
      userRole: row.userRole,
      accountExecutiveId: row.accountExecutiveId ?? undefined,
      accountExecutiveFullName: aeFullName,
    });
  }

  return result;
}

export async function deleteAssignment(
  db: Database,
  tenantId: string,
  actorId: string,
  assignmentId: string,
) {
  const [assignment] = await db
    .select()
    .from(clientAssignments)
    .where(eq(clientAssignments.id, assignmentId))
    .limit(1);

  if (!assignment) return false;

  // Si es un AE, también eliminar asignaciones de reclutadores bajo este AE en este cliente
  const [assignedUser] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, assignment.userId))
    .limit(1);

  if (assignedUser?.role === "account_executive") {
    await db
      .delete(clientAssignments)
      .where(
        and(
          eq(clientAssignments.clientId, assignment.clientId),
          eq(clientAssignments.accountExecutiveId, assignment.userId),
        ),
      );
  }

  await db
    .delete(clientAssignments)
    .where(eq(clientAssignments.id, assignmentId));

  await createAuditEvent(db, tenantId, actorId, "delete", "client_assignment", assignmentId, {
    clientId: assignment.clientId,
    userId: assignment.userId,
  }, null);

  return true;
}

// -- Batch assignments (008 expansion — polymorphic AE + recruiter) --

export type BatchAssignmentOffenderReason =
  | "not_in_tenant"
  | "inactive"
  | "invalid_role"
  | "leader_not_in_set"
  | "leader_role_mismatch";

export class BatchAssignmentValidationError extends Error {
  constructor(
    public readonly code:
      | "user_not_found"
      | "user_inactive"
      | "invalid_role"
      | "recruiter_leader_not_in_set"
      | "recruiter_leader_not_ae",
    public readonly offenders: {
      userId: string;
      reason: BatchAssignmentOffenderReason;
    }[],
  ) {
    super(`${code}: ${offenders.map((o) => o.userId).join(", ")}`);
    this.name = "BatchAssignmentValidationError";
  }
}

export interface BatchAssignmentsDesired {
  accountExecutives: string[];
  recruiters: { userId: string; accountExecutiveId?: string }[];
}

export interface BatchAssignmentsResult {
  clientId: string;
  added: {
    userId: string;
    role: "account_executive" | "recruiter";
    at: string;
  }[];
  removed: {
    userId: string;
    reason: "explicit" | "cascade";
    at: string;
  }[];
  reparented: {
    userId: string;
    from: string | null;
    to: string | null;
    at: string;
  }[];
  unchanged: string[];
}

/**
 * 008 expansion — atomic desired-state replacement of client assignments,
 * supporting both AEs and recruiters. Recruiters may optionally carry an
 * `accountExecutiveId` pointing at an AE in the desired set (their "líder"
 * on this client). Removing an AE whose recruiters are not re-parented
 * cascades to delete those recruiter rows. Admin/manager only (guarded at
 * the route layer).
 */
export async function batchAssignClient(
  db: Database,
  tenantId: string,
  actorId: string,
  clientId: string,
  desired: BatchAssignmentsDesired,
): Promise<BatchAssignmentsResult> {
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) {
    throw new Error("CLIENT_NOT_FOUND");
  }

  const desiredAEs = Array.from(new Set(desired.accountExecutives));
  const desiredRecruiters = desired.recruiters;

  // Live role validation against the DB: guards against tampering and against
  // role changes since the UI fetched its picker data.
  const allDesiredIds = Array.from(
    new Set([
      ...desiredAEs,
      ...desiredRecruiters.map((r) => r.userId),
      ...desiredRecruiters
        .map((r) => r.accountExecutiveId)
        .filter((id): id is string => Boolean(id)),
    ]),
  );

  const userRows =
    allDesiredIds.length > 0
      ? await db
          .select({
            id: users.id,
            role: users.role,
            isActive: users.isActive,
          })
          .from(users)
          .where(inArray(users.id, allDesiredIds))
      : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));

  // 1. Existence + active
  const missing: { userId: string; reason: BatchAssignmentOffenderReason }[] =
    [];
  const inactive: { userId: string; reason: BatchAssignmentOffenderReason }[] =
    [];
  for (const id of allDesiredIds) {
    const row = userById.get(id);
    if (!row) missing.push({ userId: id, reason: "not_in_tenant" });
    else if (!row.isActive)
      inactive.push({ userId: id, reason: "inactive" });
  }
  if (missing.length > 0) {
    throw new BatchAssignmentValidationError("user_not_found", missing);
  }
  if (inactive.length > 0) {
    throw new BatchAssignmentValidationError("user_inactive", inactive);
  }

  // 2. Role validation for AE entries
  const aeRoleOffenders: {
    userId: string;
    reason: BatchAssignmentOffenderReason;
  }[] = [];
  for (const id of desiredAEs) {
    const row = userById.get(id)!;
    if (row.role !== "account_executive") {
      aeRoleOffenders.push({ userId: id, reason: "invalid_role" });
    }
  }
  // 3. Role validation for recruiter entries
  for (const r of desiredRecruiters) {
    const row = userById.get(r.userId)!;
    if (row.role !== "recruiter") {
      aeRoleOffenders.push({ userId: r.userId, reason: "invalid_role" });
    }
  }
  if (aeRoleOffenders.length > 0) {
    throw new BatchAssignmentValidationError("invalid_role", aeRoleOffenders);
  }

  // 4. Recruiter leader refs — live role check (Zod already ensures the id
  //    appears in accountExecutives; here we confirm DB-side role).
  const leaderOffenders: {
    userId: string;
    reason: BatchAssignmentOffenderReason;
  }[] = [];
  const desiredAESet = new Set(desiredAEs);
  for (const r of desiredRecruiters) {
    if (!r.accountExecutiveId) continue;
    if (!desiredAESet.has(r.accountExecutiveId)) {
      leaderOffenders.push({
        userId: r.userId,
        reason: "leader_not_in_set",
      });
      continue;
    }
    const leader = userById.get(r.accountExecutiveId)!;
    if (leader.role !== "account_executive") {
      leaderOffenders.push({
        userId: r.userId,
        reason: "leader_role_mismatch",
      });
    }
  }
  if (leaderOffenders.length > 0) {
    const firstReason = leaderOffenders[0].reason;
    throw new BatchAssignmentValidationError(
      firstReason === "leader_role_mismatch"
        ? "recruiter_leader_not_ae"
        : "recruiter_leader_not_in_set",
      leaderOffenders,
    );
  }

  // Fetch current state.
  const current = await db
    .select({
      userId: clientAssignments.userId,
      accountExecutiveId: clientAssignments.accountExecutiveId,
    })
    .from(clientAssignments)
    .where(eq(clientAssignments.clientId, clientId));
  const currentByUser = new Map(
    current.map((r) => [r.userId, r.accountExecutiveId ?? null]),
  );

  const desiredByUser = new Map<string, string | null>();
  for (const id of desiredAEs) desiredByUser.set(id, null);
  for (const r of desiredRecruiters)
    desiredByUser.set(r.userId, r.accountExecutiveId ?? null);

  const toAdd: { userId: string; accountExecutiveId: string | null }[] = [];
  const toRemoveExplicit: string[] = [];
  const toReparent: {
    userId: string;
    from: string | null;
    to: string | null;
  }[] = [];
  const unchanged: string[] = [];

  for (const [userId, desiredLeader] of desiredByUser) {
    if (!currentByUser.has(userId)) {
      toAdd.push({ userId, accountExecutiveId: desiredLeader });
    } else {
      const currentLeader = currentByUser.get(userId) ?? null;
      if (currentLeader === desiredLeader) {
        unchanged.push(userId);
      } else {
        toReparent.push({
          userId,
          from: currentLeader,
          to: desiredLeader,
        });
      }
    }
  }
  for (const [userId] of currentByUser) {
    if (!desiredByUser.has(userId)) toRemoveExplicit.push(userId);
  }

  // Cascade: for every explicitly-removed AE, reclassify recruiters on this
  // client whose leader was that AE as cascades — as long as they aren't in
  // the desired set (unchanged/reparented) and aren't themselves AEs.
  const removedAESet = new Set(toRemoveExplicit);
  const toCascade: string[] = [];
  const cascadedSet = new Set<string>();
  for (const [userId, leaderId] of currentByUser) {
    if (!leaderId) continue;
    if (!removedAESet.has(leaderId)) continue;
    if (desiredByUser.has(userId)) continue;
    toCascade.push(userId);
    cascadedSet.add(userId);
  }
  // Strip cascaded recruiters from the explicit-removal list so they are
  // reported with reason="cascade" rather than "explicit".
  const explicitRemovals = toRemoveExplicit.filter(
    (id) => !cascadedSet.has(id),
  );

  // Apply writes inside a single transaction to make the diff atomic under RLS.
  await db.transaction(async (tx) => {
    // Deletions: explicit removes + cascades + reparent-old-rows.
    const idsToDelete = new Set<string>([
      ...explicitRemovals,
      ...toCascade,
      ...toReparent.map((r) => r.userId),
    ]);
    if (idsToDelete.size > 0) {
      await tx
        .delete(clientAssignments)
        .where(
          and(
            eq(clientAssignments.clientId, clientId),
            inArray(clientAssignments.userId, Array.from(idsToDelete)),
          ),
        );
    }
    // Insertions: new adds + reparent-new-rows.
    const rowsToInsert = [
      ...toAdd,
      ...toReparent.map((r) => ({
        userId: r.userId,
        accountExecutiveId: r.to,
      })),
    ];
    if (rowsToInsert.length > 0) {
      await tx.insert(clientAssignments).values(
        rowsToInsert.map((r) => ({
          tenantId,
          clientId,
          userId: r.userId,
          accountExecutiveId: r.accountExecutiveId,
        })),
      );
    }
  });

  const nowIso = new Date().toISOString();
  const result: BatchAssignmentsResult = {
    clientId,
    added: toAdd.map((r) => ({
      userId: r.userId,
      role: desiredAESet.has(r.userId)
        ? ("account_executive" as const)
        : ("recruiter" as const),
      at: nowIso,
    })),
    removed: [
      ...explicitRemovals.map((userId) => ({
        userId,
        reason: "explicit" as const,
        at: nowIso,
      })),
      ...toCascade.map((userId) => ({
        userId,
        reason: "cascade" as const,
        at: nowIso,
      })),
    ],
    reparented: toReparent.map((r) => ({ ...r, at: nowIso })),
    unchanged,
  };

  if (
    result.added.length > 0 ||
    result.removed.length > 0 ||
    result.reparented.length > 0
  ) {
    await createAuditEvent(
      db,
      tenantId,
      actorId,
      "batch_update",
      "client_assignment_batch",
      clientId,
      null,
      {
        clientId,
        added: result.added,
        removed: result.removed,
        reparented: result.reparented,
      },
    );
  }

  return result;
}

// -- Form-config custom fields (008 US6 / FR-FC-001..006) --

export class FormConfigFieldNotFoundError extends Error {
  constructor() {
    super("Field not found in client form_config.");
    this.name = "FormConfigFieldNotFoundError";
  }
}
export class FormConfigFieldDuplicateKeyError extends Error {
  constructor(public readonly key: string) {
    super(`Duplicate field key: ${key}`);
    this.name = "FormConfigFieldDuplicateKeyError";
  }
}
export class FormConfigFieldImmutableError extends Error {
  constructor(public readonly attemptedField: "key" | "type") {
    super(`Field '${attemptedField}' is immutable.`);
    this.name = "FormConfigFieldImmutableError";
  }
}
export class ClientNotFoundError extends Error {
  constructor() {
    super("Client not found.");
    this.name = "ClientNotFoundError";
  }
}

export interface CustomFieldDto {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "checkbox" | "select";
  required: boolean;
  options: string[] | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

type FormConfigWithFields = Record<string, unknown> & {
  fields?: CustomFieldDto[];
};

async function loadClientFormConfig(
  db: Database,
  clientId: string,
): Promise<FormConfigWithFields> {
  const [row] = await db
    .select({ formConfig: clients.formConfig })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!row) throw new ClientNotFoundError();
  const config = (row.formConfig ?? {}) as FormConfigWithFields;
  if (!Array.isArray(config.fields)) {
    return { ...config, fields: [] };
  }
  return config;
}

async function saveClientFormConfig(
  db: Database,
  clientId: string,
  nextConfig: FormConfigWithFields,
) {
  await db
    .update(clients)
    .set({ formConfig: nextConfig as typeof clients.$inferInsert.formConfig })
    .where(eq(clients.id, clientId));
}

export async function createFormConfigField(
  db: Database,
  tenantId: string,
  actorId: string,
  clientId: string,
  input: {
    key: string;
    label: string;
    type: CustomFieldDto["type"];
    required?: boolean;
    options?: string[] | null;
  },
): Promise<CustomFieldDto> {
  const config = await loadClientFormConfig(db, clientId);
  const existing = config.fields ?? [];
  if (existing.some((f) => f.key === input.key)) {
    throw new FormConfigFieldDuplicateKeyError(input.key);
  }
  const nowIso = new Date().toISOString();
  const field: CustomFieldDto = {
    key: input.key,
    label: input.label,
    type: input.type,
    required: input.required ?? false,
    options: input.type === "select" ? input.options ?? [] : null,
    archived: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const nextConfig: FormConfigWithFields = {
    ...config,
    fields: [...existing, field],
  };
  await saveClientFormConfig(db, clientId, nextConfig);
  await createAuditEvent(
    db,
    tenantId,
    actorId,
    "create",
    "client_form_config_field",
    clientId,
    null,
    { clientId, field },
  );
  return field;
}

export async function patchFormConfigField(
  db: Database,
  tenantId: string,
  actorId: string,
  clientId: string,
  key: string,
  input: {
    label?: string;
    required?: boolean;
    options?: string[] | null;
    archived?: boolean;
    key?: unknown;
    type?: unknown;
  },
): Promise<CustomFieldDto> {
  if ("key" in input && input.key !== undefined) {
    throw new FormConfigFieldImmutableError("key");
  }
  if ("type" in input && input.type !== undefined) {
    throw new FormConfigFieldImmutableError("type");
  }
  const config = await loadClientFormConfig(db, clientId);
  const existing = config.fields ?? [];
  const idx = existing.findIndex((f) => f.key === key);
  if (idx === -1) {
    throw new FormConfigFieldNotFoundError();
  }
  const prev = existing[idx];
  const next: CustomFieldDto = {
    ...prev,
    label: input.label ?? prev.label,
    required: input.required ?? prev.required,
    options:
      input.options !== undefined
        ? prev.type === "select"
          ? input.options ?? []
          : null
        : prev.options,
    archived: input.archived ?? prev.archived,
    updatedAt: new Date().toISOString(),
  };
  const nextFields = [...existing];
  nextFields[idx] = next;
  const nextConfig: FormConfigWithFields = {
    ...config,
    fields: nextFields,
  };
  await saveClientFormConfig(db, clientId, nextConfig);
  const action = next.archived && !prev.archived
    ? "archive"
    : !next.archived && prev.archived
      ? "unarchive"
      : "update";
  await createAuditEvent(
    db,
    tenantId,
    actorId,
    action,
    "client_form_config_field",
    clientId,
    { clientId, field: prev },
    { clientId, field: next },
  );
  return next;
}

// -- Contacts --

export async function createContact(
  db: Database,
  tenantId: string,
  actorId: string,
  clientId: string,
  input: { name: string; phone: string; email: string },
) {
  const [created] = await db
    .insert(clientContacts)
    .values({
      tenantId,
      clientId,
      name: input.name,
      phone: input.phone,
      email: input.email,
    })
    .returning();

  await createAuditEvent(db, tenantId, actorId, "create", "client_contact", created.id, null, {
    clientId,
    name: input.name,
    email: input.email,
  });

  return toContactDto(created);
}

export async function listContacts(db: Database, clientId: string) {
  const rows = await db
    .select()
    .from(clientContacts)
    .where(eq(clientContacts.clientId, clientId))
    .orderBy(clientContacts.name);

  return rows.map(toContactDto);
}

export async function updateContact(
  db: Database,
  tenantId: string,
  actorId: string,
  contactId: string,
  input: { name?: string; phone?: string; email?: string },
) {
  const [existing] = await db
    .select()
    .from(clientContacts)
    .where(eq(clientContacts.id, contactId))
    .limit(1);

  if (!existing) return null;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.email !== undefined) updateData.email = input.email;

  const [updated] = await db
    .update(clientContacts)
    .set(updateData)
    .where(eq(clientContacts.id, contactId))
    .returning();

  await createAuditEvent(db, tenantId, actorId, "update", "client_contact", contactId, {
    name: existing.name,
    email: existing.email,
  }, {
    name: updated.name,
    email: updated.email,
  });

  return toContactDto(updated);
}

export async function deleteContact(
  db: Database,
  tenantId: string,
  actorId: string,
  contactId: string,
) {
  const [existing] = await db
    .select()
    .from(clientContacts)
    .where(eq(clientContacts.id, contactId))
    .limit(1);

  if (!existing) return false;

  await db.delete(clientContacts).where(eq(clientContacts.id, contactId));

  await createAuditEvent(db, tenantId, actorId, "delete", "client_contact", contactId, {
    name: existing.name,
    email: existing.email,
  }, null);

  return true;
}

// -- Positions --

export async function createPosition(
  db: Database,
  tenantId: string,
  actorId: string,
  clientId: string,
  input: { name: string },
) {
  // Verificar unicidad de nombre (solo activos)
  const [existing] = await db
    .select({ id: clientPositions.id })
    .from(clientPositions)
    .where(
      and(
        eq(clientPositions.clientId, clientId),
        eq(clientPositions.name, input.name),
        eq(clientPositions.isActive, true),
      ),
    )
    .limit(1);

  if (existing) {
    throw new Error("POSITION_DUPLICATE");
  }

  const [created] = await db
    .insert(clientPositions)
    .values({
      tenantId,
      clientId,
      name: input.name,
    })
    .returning();

  await createAuditEvent(db, tenantId, actorId, "create", "client_position", created.id, null, {
    clientId,
    name: input.name,
  });

  return toPositionDto(created);
}

export async function listPositions(
  db: Database,
  clientId: string,
  includeInactive = false,
) {
  const conditions = [eq(clientPositions.clientId, clientId)];
  if (!includeInactive) {
    conditions.push(eq(clientPositions.isActive, true));
  }

  const rows = await db
    .select()
    .from(clientPositions)
    .where(and(...conditions))
    .orderBy(clientPositions.name);

  return rows.map(toPositionDto);
}

export async function updatePosition(
  db: Database,
  tenantId: string,
  actorId: string,
  positionId: string,
  input: { name?: string },
) {
  const [existing] = await db
    .select()
    .from(clientPositions)
    .where(eq(clientPositions.id, positionId))
    .limit(1);

  if (!existing) return null;

  if (input.name && input.name !== existing.name) {
    // Verificar unicidad del nuevo nombre
    const [dup] = await db
      .select({ id: clientPositions.id })
      .from(clientPositions)
      .where(
        and(
          eq(clientPositions.clientId, existing.clientId),
          eq(clientPositions.name, input.name),
          eq(clientPositions.isActive, true),
        ),
      )
      .limit(1);

    if (dup) {
      throw new Error("POSITION_DUPLICATE");
    }
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updateData.name = input.name;

  const [updated] = await db
    .update(clientPositions)
    .set(updateData)
    .where(eq(clientPositions.id, positionId))
    .returning();

  await createAuditEvent(db, tenantId, actorId, "update", "client_position", positionId, {
    name: existing.name,
  }, {
    name: updated.name,
  });

  return toPositionDto(updated);
}

export async function deletePosition(
  db: Database,
  tenantId: string,
  actorId: string,
  positionId: string,
) {
  const [existing] = await db
    .select()
    .from(clientPositions)
    .where(eq(clientPositions.id, positionId))
    .limit(1);

  if (!existing) return false;

  // TODO: cuando el módulo de candidatos exista, verificar si hay candidatos vinculados
  // Por ahora, hard delete (no hay candidatos aún)
  await db.delete(clientPositions).where(eq(clientPositions.id, positionId));

  await createAuditEvent(db, tenantId, actorId, "delete", "client_position", positionId, {
    name: existing.name,
  }, null);

  return true;
}

// -- Documents --

export async function createDocumentRecord(
  db: Database,
  tenantId: string,
  actorId: string,
  clientId: string,
  input: {
    originalName: string;
    documentType: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  },
) {
  const [created] = await db
    .insert(clientDocuments)
    .values({
      tenantId,
      clientId,
      originalName: input.originalName,
      documentType: input.documentType,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey: input.storageKey,
      uploadedBy: actorId,
    })
    .returning();

  await createAuditEvent(db, tenantId, actorId, "create", "client_document", created.id, null, {
    clientId,
    originalName: input.originalName,
    documentType: input.documentType,
  });

  return created;
}

export async function listDocuments(db: Database, clientId: string) {
  const rows = await db
    .select({
      id: clientDocuments.id,
      clientId: clientDocuments.clientId,
      originalName: clientDocuments.originalName,
      documentType: clientDocuments.documentType,
      mimeType: clientDocuments.mimeType,
      sizeBytes: clientDocuments.sizeBytes,
      storageKey: clientDocuments.storageKey,
      uploadedBy: clientDocuments.uploadedBy,
      createdAt: clientDocuments.createdAt,
      uploaderFirstName: users.firstName,
      uploaderLastName: users.lastName,
    })
    .from(clientDocuments)
    .innerJoin(users, eq(clientDocuments.uploadedBy, users.id))
    .where(eq(clientDocuments.clientId, clientId))
    .orderBy(clientDocuments.createdAt);

  return rows.map((row): IClientDocumentDto => ({
    id: row.id,
    clientId: row.clientId,
    originalName: row.originalName,
    documentType: row.documentType as IClientDocumentDto["documentType"],
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy,
    uploaderName: `${row.uploaderFirstName} ${row.uploaderLastName}`,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getDocumentById(db: Database, documentId: string) {
  const [row] = await db
    .select()
    .from(clientDocuments)
    .where(eq(clientDocuments.id, documentId))
    .limit(1);

  return row ?? null;
}

export async function deleteDocumentRecord(
  db: Database,
  tenantId: string,
  actorId: string,
  documentId: string,
) {
  const [existing] = await db
    .select()
    .from(clientDocuments)
    .where(eq(clientDocuments.id, documentId))
    .limit(1);

  if (!existing) return null;

  await db.delete(clientDocuments).where(eq(clientDocuments.id, documentId));

  await createAuditEvent(db, tenantId, actorId, "delete", "client_document", documentId, {
    originalName: existing.originalName,
    documentType: existing.documentType,
  }, null);

  return existing;
}
