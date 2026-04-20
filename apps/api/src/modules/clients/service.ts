import { eq, and, ilike, sql, count } from "drizzle-orm";
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
