// 007-candidates-module — capa de servicio.
// Las funciones se irán agregando por User Story; US1 cubre createCandidate,
// findDuplicatesProbe y getActivePrivacyNotice.
import {
  and,
  eq,
  desc,
  inArray,
  gte,
  lte,
  or,
  sql,
  lt,
} from "drizzle-orm";
import {
  candidates,
  candidateDuplicateLinks,
  clientAssignments,
  clients,
  privacyNotices,
  users,
  auditEvents,
} from "@bepro/db";
import type { Database } from "@bepro/db";
import {
  buildDynamicSchema,
  type CandidateStatus,
  type ICandidateDetail,
  type ICandidateListItem,
  type IDuplicateSummary,
  type ListCandidatesQuery,
  type RegisterCandidateRequest,
  type UserRole,
} from "@bepro/shared";
import { recordAuditEvent } from "../../lib/audit.js";
import {
  findDuplicatesForCandidate,
  normalizePhone,
} from "./duplicates.js";

// ----- Errores tipados consumidos por las rutas -----

export class DuplicatesDetectedError extends Error {
  readonly code = "duplicates_detected" as const;
  constructor(public readonly duplicates: IDuplicateSummary[]) {
    super("Possible duplicate candidates found for this client.");
    this.name = "DuplicatesDetectedError";
  }
}

export class FormConfigValidationError extends Error {
  readonly code = "form_config_invalid" as const;
  constructor(public readonly issues: unknown[]) {
    super("additional_fields no cumple la configuración del cliente.");
    this.name = "FormConfigValidationError";
  }
}

export class PrivacyNoticeMismatchError extends Error {
  readonly code = "privacy_notice_invalid" as const;
  constructor() {
    super(
      "El privacy_notice_id proporcionado no es la versión activa del tenant.",
    );
    this.name = "PrivacyNoticeMismatchError";
  }
}

export class ClientNotFoundError extends Error {
  readonly code = "client_not_found" as const;
  constructor() {
    super("Cliente no encontrado o inactivo en este tenant.");
    this.name = "ClientNotFoundError";
  }
}

// ----- Mapeo de fila a DTO -----

type CandidateRow = typeof candidates.$inferSelect;

export function toCandidateDetail(
  row: CandidateRow,
  client: { id: string; name: string },
  registeringUser: { id: string; display_name: string },
): ICandidateDetail {
  return {
    id: row.id,
    tenant_id: row.tenantId,
    client: client,
    client_id: row.clientId,
    registering_user_id: row.registeringUserId,
    registering_user: registeringUser,
    first_name: row.firstName,
    last_name: row.lastName,
    phone: row.phone,
    email: row.email,
    current_position: row.currentPosition,
    source: row.source,
    status: row.status as CandidateStatus,
    additional_fields: (row.additionalFields ?? {}) as Record<string, unknown>,
    rejection_category_id: row.rejectionCategoryId,
    decline_category_id: row.declineCategoryId,
    privacy_notice_id: row.privacyNoticeId,
    privacy_notice_acknowledged_at: row.privacyNoticeAcknowledgedAt.toISOString(),
    is_active: row.isActive,
    updated_at: row.updatedAt.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

// ----- US1: GET /api/candidates/privacy-notice/active -----

export async function getActivePrivacyNotice(
  db: Database,
  tenantId: string,
): Promise<{
  id: string;
  version: string;
  text_md: string;
  effective_from: string;
} | null> {
  const [row] = await db
    .select()
    .from(privacyNotices)
    .where(
      and(
        eq(privacyNotices.tenantId, tenantId),
        eq(privacyNotices.isActive, true),
      ),
    )
    .orderBy(desc(privacyNotices.effectiveFrom))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    version: row.version,
    text_md: row.textMd,
    effective_from: row.effectiveFrom.toISOString(),
  };
}

// ----- US1: GET /api/candidates/duplicates (sondeo) -----

export async function probeDuplicates(
  db: Database,
  tenantId: string,
  input: { client_id: string; phone: string },
): Promise<IDuplicateSummary[]> {
  return findDuplicatesForCandidate(db, {
    tenantId,
    clientId: input.client_id,
    phoneRaw: input.phone,
  });
}

// ----- US1: POST /api/candidates -----

export interface CreateCandidateContext {
  tenantId: string;
  actorId: string;
}

export interface CreateCandidateResult {
  candidate: ICandidateDetail;
}

export async function createCandidate(
  db: Database,
  ctx: CreateCandidateContext,
  input: RegisterCandidateRequest,
): Promise<CreateCandidateResult> {
  // 1) Verificar el cliente existe, está activo y pertenece al tenant.
  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      formConfig: clients.formConfig,
      isActive: clients.isActive,
    })
    .from(clients)
    .where(
      and(eq(clients.id, input.client_id), eq(clients.tenantId, ctx.tenantId)),
    );
  if (!client || !client.isActive) {
    throw new ClientNotFoundError();
  }

  // 2) Validar el privacy_notice_id contra el aviso activo del tenant.
  const [notice] = await db
    .select({
      id: privacyNotices.id,
      version: privacyNotices.version,
      isActive: privacyNotices.isActive,
    })
    .from(privacyNotices)
    .where(
      and(
        eq(privacyNotices.id, input.privacy_notice_id),
        eq(privacyNotices.tenantId, ctx.tenantId),
      ),
    );
  if (!notice || !notice.isActive) {
    throw new PrivacyNoticeMismatchError();
  }

  // 3) Validar additional_fields contra el form_config del cliente (R7 / FR-012).
  //    El schema dinámico es vacío si formConfig no tiene `fields[]`, por lo que
  //    los tenants que aún usan el formato legacy de flags no rompen.
  const dynamicSchema = buildDynamicSchema(client.formConfig as never);
  const dynamicResult = dynamicSchema.safeParse(input.additional_fields ?? {});
  if (!dynamicResult.success) {
    throw new FormConfigValidationError(dynamicResult.error.issues);
  }

  // 4) Detección de duplicados (R2 / FR-014).
  const duplicates = await findDuplicatesForCandidate(db, {
    tenantId: ctx.tenantId,
    clientId: input.client_id,
    phoneRaw: input.phone,
  });

  const confirmed = new Set(
    input.duplicate_confirmation?.confirmed_duplicate_ids ?? [],
  );
  const unconfirmedDuplicates = duplicates.filter((d) => !confirmed.has(d.id));
  if (unconfirmedDuplicates.length > 0) {
    throw new DuplicatesDetectedError(duplicates);
  }

  // 5) Insertar candidato + audit + dup_links en una sola transacción.
  const phoneNormalized = normalizePhone(input.phone);
  const acknowledgedAt = new Date();

  const [created] = await db
    .insert(candidates)
    .values({
      tenantId: ctx.tenantId,
      clientId: input.client_id,
      registeringUserId: ctx.actorId,
      firstName: input.first_name,
      lastName: input.last_name,
      phone: input.phone,
      phoneNormalized,
      email: input.email,
      currentPosition: input.current_position ?? null,
      source: input.source,
      status: "registered",
      additionalFields: dynamicResult.data,
      privacyNoticeId: notice.id,
      privacyNoticeAcknowledgedAt: acknowledgedAt,
      isActive: true,
    })
    .returning();

  // 6) Insertar links de duplicados confirmados (FR-015).
  if (duplicates.length > 0) {
    const linkRows = duplicates
      .filter((d) => confirmed.has(d.id))
      .map((d) => ({
        tenantId: ctx.tenantId,
        candidateId: created.id,
        duplicateOfCandidateId: d.id,
        confirmedByUserId: ctx.actorId,
      }));
    if (linkRows.length > 0) {
      await db.insert(candidateDuplicateLinks).values(linkRows);
    }
  }

  // 7) Audit event (R3 / FR-060) — sin PII en new_values.
  await recordAuditEvent(db, {
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    action: "candidate.created",
    targetType: "candidate",
    targetId: created.id,
    oldValues: null,
    newValues: {
      id: created.id,
      client_id: created.clientId,
      status: created.status,
      privacy_notice_id: notice.id,
      privacy_notice_version: notice.version,
      privacy_notice_acknowledged_at: created.privacyNoticeAcknowledgedAt.toISOString(),
      source: created.source,
      duplicates_confirmed: Array.from(confirmed),
    },
  });

  // 8) Resolver el nombre del recruiter para el DTO.
  const [recruiter] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, ctx.actorId));

  return {
    candidate: toCandidateDetail(
      created,
      { id: client.id, name: client.name },
      {
        id: ctx.actorId,
        display_name: recruiter
          ? `${recruiter.firstName} ${recruiter.lastName}`.trim()
          : "—",
      },
    ),
  };
}

// ----- US2: GET /api/candidates (listado paginado, role-scoped) -----

export interface ActorContext {
  tenantId: string;
  actorId: string;
  role: UserRole;
}

export interface ListCandidatesResult {
  items: ICandidateListItem[];
  next_cursor: string | null;
}

interface KeysetCursor {
  updated_at: string;
  id: string;
}

function encodeCursor(c: KeysetCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(raw: string): KeysetCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8"),
    ) as Partial<KeysetCursor>;
    if (typeof parsed.updated_at !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    return { updated_at: parsed.updated_at, id: parsed.id };
  } catch {
    return null;
  }
}

// Filtros derivados del rol del actor (FR-020).
async function buildRoleScope(
  db: Database,
  actor: ActorContext,
): Promise<ReturnType<typeof and> | undefined> {
  if (actor.role === "recruiter") {
    return eq(candidates.registeringUserId, actor.actorId);
  }
  if (actor.role === "account_executive") {
    const assignments = await db
      .select({ clientId: clientAssignments.clientId })
      .from(clientAssignments)
      .where(eq(clientAssignments.userId, actor.actorId));
    const clientIds = assignments.map((a) => a.clientId);
    if (clientIds.length === 0) {
      // Sin clientes asignados → forzar resultado vacío.
      return sql`false`;
    }
    return inArray(candidates.clientId, clientIds);
  }
  // manager / admin: sin filtro adicional; RLS resuelve el tenant.
  return undefined;
}

export async function listCandidates(
  db: Database,
  actor: ActorContext,
  query: ListCandidatesQuery,
): Promise<ListCandidatesResult> {
  const conditions = [eq(candidates.tenantId, actor.tenantId)];

  // include_inactive sólo para manager/admin.
  const allowInactive =
    query.include_inactive && (actor.role === "manager" || actor.role === "admin");
  if (!allowInactive) {
    conditions.push(eq(candidates.isActive, true));
  }

  const roleScope = await buildRoleScope(db, actor);
  if (roleScope) conditions.push(roleScope);

  if (query.status?.length) {
    conditions.push(inArray(candidates.status, query.status));
  }
  if (query.client_id?.length) {
    conditions.push(inArray(candidates.clientId, query.client_id));
  }
  if (query.recruiter_user_id?.length) {
    if (actor.role !== "manager" && actor.role !== "admin") {
      // Filtro recruiter sólo aplicable para manager/admin.
    } else {
      conditions.push(
        inArray(candidates.registeringUserId, query.recruiter_user_id),
      );
    }
  }
  if (query.rejection_category_id?.length) {
    conditions.push(
      inArray(candidates.rejectionCategoryId, query.rejection_category_id),
    );
  }
  if (query.decline_category_id?.length) {
    conditions.push(
      inArray(candidates.declineCategoryId, query.decline_category_id),
    );
  }
  if (query.updated_from) {
    conditions.push(gte(candidates.updatedAt, new Date(query.updated_from)));
  }
  if (query.updated_to) {
    conditions.push(lte(candidates.updatedAt, new Date(query.updated_to)));
  }
  if (query.q) {
    const pattern = `%${query.q}%`;
    conditions.push(
      or(
        sql`${candidates.firstName} ILIKE ${pattern}`,
        sql`${candidates.lastName} ILIKE ${pattern}`,
        sql`${candidates.email} ILIKE ${pattern}`,
        sql`${candidates.phoneNormalized} ILIKE ${pattern}`,
      )!,
    );
  }

  // Cursor (keyset por updated_at DESC, id DESC).
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    if (cursor) {
      const cursorDate = new Date(cursor.updated_at);
      conditions.push(
        or(
          lt(candidates.updatedAt, cursorDate),
          and(
            eq(candidates.updatedAt, cursorDate),
            lt(candidates.id, cursor.id),
          ),
        )!,
      );
    }
  }

  const limit = query.limit ?? 25;

  const rows = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      clientId: candidates.clientId,
      clientName: clients.name,
      status: candidates.status,
      updatedAt: candidates.updatedAt,
      registeringUserId: candidates.registeringUserId,
      isActive: candidates.isActive,
      registeringFirstName: users.firstName,
      registeringLastName: users.lastName,
    })
    .from(candidates)
    .innerJoin(clients, eq(clients.id, candidates.clientId))
    .innerJoin(users, eq(users.id, candidates.registeringUserId))
    .where(and(...conditions))
    .orderBy(desc(candidates.updatedAt), desc(candidates.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;

  const items: ICandidateListItem[] = trimmed.map((r) => ({
    id: r.id,
    first_name: r.firstName,
    last_name: r.lastName,
    client: { id: r.clientId, name: r.clientName },
    status: r.status as CandidateStatus,
    updated_at: r.updatedAt.toISOString(),
    registering_user: {
      id: r.registeringUserId,
      display_name: `${r.registeringFirstName} ${r.registeringLastName}`.trim(),
    },
    is_active: r.isActive,
  }));

  const last = trimmed[trimmed.length - 1];
  const next_cursor =
    hasMore && last
      ? encodeCursor({
          updated_at: last.updatedAt.toISOString(),
          id: last.id,
        })
      : null;

  return { items, next_cursor };
}

// ----- US2: GET /api/candidates/:id -----

export interface CandidateDetailResult {
  candidate: ICandidateDetail;
  privacy_notice: { id: string; version: string; effective_from: string } | null;
  status_history: Array<{
    id: string;
    actor_id: string;
    created_at: string;
    old_values: unknown;
    new_values: unknown;
  }>;
  duplicate_links: {
    as_new: string[];
    as_existing: string[];
  };
}

// Aplica el mismo gate de rol que el listado: out-of-scope → null (la ruta lo mapea a 404).
export async function getCandidateById(
  db: Database,
  actor: ActorContext,
  candidateId: string,
): Promise<CandidateDetailResult | null> {
  const baseConditions = [
    eq(candidates.tenantId, actor.tenantId),
    eq(candidates.id, candidateId),
  ];
  const roleScope = await buildRoleScope(db, actor);
  if (roleScope) baseConditions.push(roleScope);

  const [row] = await db
    .select({
      candidate: candidates,
      clientName: clients.name,
      registeringFirstName: users.firstName,
      registeringLastName: users.lastName,
      noticeVersion: privacyNotices.version,
      noticeEffectiveFrom: privacyNotices.effectiveFrom,
    })
    .from(candidates)
    .innerJoin(clients, eq(clients.id, candidates.clientId))
    .innerJoin(users, eq(users.id, candidates.registeringUserId))
    .innerJoin(
      privacyNotices,
      eq(privacyNotices.id, candidates.privacyNoticeId),
    )
    .where(and(...baseConditions));

  if (!row) return null;

  const detail = toCandidateDetail(
    row.candidate,
    { id: row.candidate.clientId, name: row.clientName },
    {
      id: row.candidate.registeringUserId,
      display_name: `${row.registeringFirstName} ${row.registeringLastName}`.trim(),
    },
  );

  const history = await db
    .select()
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.tenantId, actor.tenantId),
        eq(auditEvents.targetType, "candidate"),
        eq(auditEvents.targetId, candidateId),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(50);

  const dupLinks = await db
    .select({
      candidateId: candidateDuplicateLinks.candidateId,
      duplicateOfCandidateId: candidateDuplicateLinks.duplicateOfCandidateId,
    })
    .from(candidateDuplicateLinks)
    .where(
      and(
        eq(candidateDuplicateLinks.tenantId, actor.tenantId),
        or(
          eq(candidateDuplicateLinks.candidateId, candidateId),
          eq(candidateDuplicateLinks.duplicateOfCandidateId, candidateId),
        )!,
      ),
    );

  return {
    candidate: detail,
    privacy_notice: {
      id: row.candidate.privacyNoticeId,
      version: row.noticeVersion,
      effective_from: row.noticeEffectiveFrom.toISOString(),
    },
    status_history: history.map((h) => ({
      id: h.id,
      actor_id: h.actorId,
      created_at: h.createdAt.toISOString(),
      old_values: h.oldValues,
      new_values: h.newValues,
    })),
    duplicate_links: {
      as_new: dupLinks
        .filter((l) => l.candidateId === candidateId)
        .map((l) => l.duplicateOfCandidateId),
      as_existing: dupLinks
        .filter((l) => l.duplicateOfCandidateId === candidateId)
        .map((l) => l.candidateId),
    },
  };
}

// ----- US3: FSM transitions + reactivation -----

import {
  assertLegalTransition,
  assertRoleAllowsTransition,
  TransitionError,
} from "./fsm.js";
import {
  isNegativeTerminal,
  type TransitionRequest,
  type ReactivateRequest,
} from "@bepro/shared";
import { rejectionCategories, declineCategories } from "@bepro/db";

export class StaleStatusError extends Error {
  readonly code = "stale_status" as const;
  constructor(public readonly currentStatus: CandidateStatus) {
    super("El estado del candidato cambió desde la última lectura.");
    this.name = "StaleStatusError";
  }
}

export class CandidateNotFoundError extends Error {
  readonly code = "candidate_not_found" as const;
  constructor() {
    super("Candidato no encontrado.");
    this.name = "CandidateNotFoundError";
  }
}

export class InvalidReactivationError extends Error {
  readonly code = "invalid_reactivation" as const;
  constructor(message: string, public readonly status: 409 | 422) {
    super(message);
    this.name = "InvalidReactivationError";
  }
}

export interface TransitionResult {
  candidate: ICandidateDetail;
  transition: {
    id: string;
    from_status: CandidateStatus;
    to_status: CandidateStatus;
    actor_user_id: string;
    created_at: string;
  };
}

export async function transitionCandidate(
  db: Database,
  actor: ActorContext,
  candidateId: string,
  input: TransitionRequest,
): Promise<TransitionResult> {
  // 1) Cargar el candidato (con scoping por tenant + role gate previa).
  const baseConditions = [
    eq(candidates.tenantId, actor.tenantId),
    eq(candidates.id, candidateId),
  ];
  const roleScope = await buildRoleScope(db, actor);
  if (roleScope) baseConditions.push(roleScope);

  const [row] = await db
    .select()
    .from(candidates)
    .where(and(...baseConditions));

  if (!row) {
    // 404 (no enumeration) — incluye "el AE no tiene este cliente asignado".
    throw new CandidateNotFoundError();
  }

  // 2) Validar concurrencia óptima (R6 / FR-037).
  if (row.status !== input.from_status) {
    throw new StaleStatusError(row.status as CandidateStatus);
  }

  // 3) Validar FSM (capa A) y rol (capa B). Las funciones lanzan TransitionError.
  assertLegalTransition(row.status as CandidateStatus, input.to_status);
  assertRoleAllowsTransition({
    role: actor.role,
    userId: actor.actorId,
    clientAssignments:
      actor.role === "account_executive"
        ? await db
            .select({ id: clientAssignments.clientId })
            .from(clientAssignments)
            .where(eq(clientAssignments.userId, actor.actorId))
            .then((rows) => rows.map((r) => r.id))
        : [],
    candidate: {
      id: row.id,
      client_id: row.clientId,
      status: row.status as CandidateStatus,
    },
    toStatus: input.to_status,
  });

  // 4) Si la transición requiere categoría, snapshot de la etiqueta para el audit.
  let categoryLabel: string | undefined;
  if (input.to_status === "rejected" && input.rejection_category_id) {
    const [cat] = await db
      .select({ label: rejectionCategories.label })
      .from(rejectionCategories)
      .where(
        and(
          eq(rejectionCategories.id, input.rejection_category_id),
          eq(rejectionCategories.tenantId, actor.tenantId),
        ),
      );
    if (!cat) {
      throw new TransitionError(
        "La categoría de rechazo no existe en este tenant.",
        "fsm_illegal",
        422,
      );
    }
    categoryLabel = cat.label;
  }
  if (input.to_status === "declined" && input.decline_category_id) {
    const [cat] = await db
      .select({ label: declineCategories.label })
      .from(declineCategories)
      .where(
        and(
          eq(declineCategories.id, input.decline_category_id),
          eq(declineCategories.tenantId, actor.tenantId),
        ),
      );
    if (!cat) {
      throw new TransitionError(
        "La categoría de declinación no existe en este tenant.",
        "fsm_illegal",
        422,
      );
    }
    categoryLabel = cat.label;
  }

  // 5) Update atómico — status + (si negativo terminal) is_active=false.
  const flipsInactive = isNegativeTerminal(input.to_status);
  const now = new Date();

  const updateValues: Record<string, unknown> = {
    status: input.to_status,
    updatedAt: now,
  };
  if (flipsInactive) updateValues.isActive = false;
  if (input.to_status === "rejected") {
    updateValues.rejectionCategoryId = input.rejection_category_id ?? null;
  }
  if (input.to_status === "declined") {
    updateValues.declineCategoryId = input.decline_category_id ?? null;
  }

  const [updated] = await db
    .update(candidates)
    .set(updateValues)
    .where(
      and(
        eq(candidates.id, candidateId),
        eq(candidates.tenantId, actor.tenantId),
        eq(candidates.status, input.from_status),
      ),
    )
    .returning();

  if (!updated) {
    // Carrera entre el SELECT y el UPDATE — devolvemos stale.
    throw new StaleStatusError(row.status as CandidateStatus);
  }

  // 6) Audit (FR-060) — append-only.
  await recordAuditEvent(db, {
    tenantId: actor.tenantId,
    actorId: actor.actorId,
    action: "candidate.status.changed",
    targetType: "candidate",
    targetId: candidateId,
    oldValues: {
      status: row.status,
      is_active: row.isActive,
    },
    newValues: {
      status: updated.status,
      is_active: updated.isActive,
      rejection_category_id: updated.rejectionCategoryId,
      decline_category_id: updated.declineCategoryId,
      rejection_category_label:
        input.to_status === "rejected" ? categoryLabel : undefined,
      decline_category_label:
        input.to_status === "declined" ? categoryLabel : undefined,
      note: input.note,
    },
  });

  // 7) Construir DTO con cliente + reclutador para la respuesta.
  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, updated.clientId));
  const [recruiter] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, updated.registeringUserId));

  // El audit insert no devuelve id — usar el último audit del candidato.
  const [lastAudit] = await db
    .select({ id: auditEvents.id, createdAt: auditEvents.createdAt })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.tenantId, actor.tenantId),
        eq(auditEvents.targetId, candidateId),
        eq(auditEvents.action, "candidate.status.changed"),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(1);

  return {
    candidate: toCandidateDetail(
      updated,
      { id: client?.id ?? updated.clientId, name: client?.name ?? "—" },
      {
        id: updated.registeringUserId,
        display_name: recruiter
          ? `${recruiter.firstName} ${recruiter.lastName}`.trim()
          : "—",
      },
    ),
    transition: {
      id: lastAudit?.id ?? "",
      from_status: input.from_status,
      to_status: input.to_status,
      actor_user_id: actor.actorId,
      created_at: (lastAudit?.createdAt ?? now).toISOString(),
    },
  };
}

// ----- FR-038a: Reactivación admin -----

export interface ReactivationResult {
  candidate: ICandidateDetail;
  reactivation: {
    actor_user_id: string;
    created_at: string;
    note?: string;
  };
}

export async function reactivateCandidate(
  db: Database,
  actor: ActorContext,
  candidateId: string,
  input: ReactivateRequest,
): Promise<ReactivationResult> {
  if (actor.role !== "admin") {
    // Reactivación es admin-only; mascararamos como 404 en la ruta.
    throw new CandidateNotFoundError();
  }

  const [row] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, candidateId),
        eq(candidates.tenantId, actor.tenantId),
      ),
    );
  if (!row) throw new CandidateNotFoundError();

  if (row.isActive) {
    throw new InvalidReactivationError(
      "El candidato ya está activo.",
      422,
    );
  }
  if (!isNegativeTerminal(row.status as CandidateStatus)) {
    throw new InvalidReactivationError(
      "Sólo se puede reactivar desde un estado terminal negativo.",
      409,
    );
  }

  const now = new Date();
  const [updated] = await db
    .update(candidates)
    .set({ isActive: true, updatedAt: now })
    .where(eq(candidates.id, candidateId))
    .returning();

  await recordAuditEvent(db, {
    tenantId: actor.tenantId,
    actorId: actor.actorId,
    action: "candidate.reactivated",
    targetType: "candidate",
    targetId: candidateId,
    oldValues: { is_active: false },
    newValues: { is_active: true, note: input.note },
  });

  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, updated.clientId));
  const [recruiter] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, updated.registeringUserId));

  return {
    candidate: toCandidateDetail(
      updated,
      { id: client?.id ?? updated.clientId, name: client?.name ?? "—" },
      {
        id: updated.registeringUserId,
        display_name: recruiter
          ? `${recruiter.firstName} ${recruiter.lastName}`.trim()
          : "—",
      },
    ),
    reactivation: {
      actor_user_id: actor.actorId,
      created_at: now.toISOString(),
      note: input.note,
    },
  };
}

// ----- US4: Attachments -----
import {
  candidateAttachments,
  type CandidateAttachmentRow,
} from "@bepro/db";
import { buildStorageKey } from "./storage.js";
import type { AttachmentInitInput } from "@bepro/shared";

export class AttachmentNotFoundError extends Error {
  readonly code = "attachment_not_found" as const;
  constructor() {
    super("Adjunto no encontrado.");
    this.name = "AttachmentNotFoundError";
  }
}

export class AttachmentForbiddenError extends Error {
  readonly code = "attachment_forbidden" as const;
  constructor() {
    super("No tienes permisos sobre este adjunto.");
    this.name = "AttachmentForbiddenError";
  }
}

// Verifica que el actor tiene permiso de edición sobre el candidato (FR-040 / Edit-permission def).
async function actorCanEditCandidate(
  db: Database,
  actor: ActorContext,
  candidateRow: typeof candidates.$inferSelect,
): Promise<boolean> {
  if (actor.role === "manager" || actor.role === "admin") return true;
  if (actor.role === "account_executive") {
    const assignments = await db
      .select({ clientId: clientAssignments.clientId })
      .from(clientAssignments)
      .where(eq(clientAssignments.userId, actor.actorId));
    return assignments.some((a) => a.clientId === candidateRow.clientId);
  }
  if (actor.role === "recruiter") {
    return (
      candidateRow.registeringUserId === actor.actorId &&
      candidateRow.status === "registered"
    );
  }
  return false;
}

export interface InitAttachmentResult {
  attachment_id: string;
  storage_key: string;
  // Para v1 el cliente sube directo a través del worker (POST .../upload).
  upload_url: string;
}

// Crea la fila de adjunto con uploaded_at=NULL y devuelve la URL (relativa) por
// donde el cliente subirá el binario al worker (R4 — presigned se difiere).
export async function initAttachment(
  db: Database,
  actor: ActorContext,
  candidateId: string,
  input: AttachmentInitInput,
): Promise<InitAttachmentResult> {
  const [cand] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, candidateId),
        eq(candidates.tenantId, actor.tenantId),
      ),
    );
  if (!cand) throw new CandidateNotFoundError();
  if (!(await actorCanEditCandidate(db, actor, cand))) {
    throw new AttachmentForbiddenError();
  }

  const [created] = await db
    .insert(candidateAttachments)
    .values({
      candidateId,
      tenantId: actor.tenantId,
      uploaderUserId: actor.actorId,
      fileName: input.file_name,
      mimeType: input.mime_type,
      sizeBytes: input.size_bytes,
      storageKey: "pending", // se reemplaza con el id real abajo
      tag: input.tag ?? null,
      uploadedAt: null,
    })
    .returning();

  const storageKey = buildStorageKey({
    tenantId: actor.tenantId,
    candidateId,
    attachmentId: created.id,
    fileName: input.file_name,
  });
  // Persistir el storage_key real (ya con id) y devolver al cliente.
  await db
    .update(candidateAttachments)
    .set({ storageKey })
    .where(eq(candidateAttachments.id, created.id));

  return {
    attachment_id: created.id,
    storage_key: storageKey,
    upload_url: `/api/candidates/${candidateId}/attachments/${created.id}/upload`,
  };
}

// Sube el binario al bucket R2 (FILES) y finaliza el adjunto.
export async function uploadAttachment(
  db: Database,
  actor: ActorContext,
  candidateId: string,
  attachmentId: string,
  body: ReadableStream<Uint8Array> | ArrayBuffer | Uint8Array,
  bucket: R2Bucket,
): Promise<CandidateAttachmentRow> {
  const [att] = await db
    .select()
    .from(candidateAttachments)
    .where(
      and(
        eq(candidateAttachments.id, attachmentId),
        eq(candidateAttachments.candidateId, candidateId),
        eq(candidateAttachments.tenantId, actor.tenantId),
      ),
    );
  if (!att) throw new AttachmentNotFoundError();

  // Permiso de edición sobre el candidato.
  const [cand] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId));
  if (!cand || !(await actorCanEditCandidate(db, actor, cand))) {
    throw new AttachmentForbiddenError();
  }

  await bucket.put(att.storageKey, body, {
    httpMetadata: { contentType: att.mimeType },
  });

  const [updated] = await db
    .update(candidateAttachments)
    .set({ uploadedAt: new Date(), updatedAt: new Date() })
    .where(eq(candidateAttachments.id, attachmentId))
    .returning();

  await recordAuditEvent(db, {
    tenantId: actor.tenantId,
    actorId: actor.actorId,
    action: "candidate.attachment.added",
    targetType: "candidate",
    targetId: candidateId,
    oldValues: null,
    newValues: {
      attachment_id: attachmentId,
      file_name: att.fileName,
      mime_type: att.mimeType,
      size_bytes: att.sizeBytes,
      tag: att.tag,
    },
  });

  return updated;
}

export async function listAttachments(
  db: Database,
  actor: ActorContext,
  candidateId: string,
  includeObsolete = false,
): Promise<CandidateAttachmentRow[]> {
  // Reutiliza el role gate del listado: si no puede VER el candidato, lista vacía.
  const detail = await getCandidateById(db, actor, candidateId);
  if (!detail) throw new CandidateNotFoundError();

  const where = [
    eq(candidateAttachments.tenantId, actor.tenantId),
    eq(candidateAttachments.candidateId, candidateId),
    eq(candidateAttachments.isActive, true),
  ];
  if (!includeObsolete) {
    where.push(eq(candidateAttachments.isObsolete, false));
  }

  return await db
    .select()
    .from(candidateAttachments)
    .where(and(...where))
    .orderBy(desc(candidateAttachments.uploadedAt));
}

export async function getAttachmentDownload(
  db: Database,
  actor: ActorContext,
  candidateId: string,
  attachmentId: string,
  bucket: R2Bucket,
): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string;
  fileName: string;
}> {
  const detail = await getCandidateById(db, actor, candidateId);
  if (!detail) throw new CandidateNotFoundError();

  const [att] = await db
    .select()
    .from(candidateAttachments)
    .where(
      and(
        eq(candidateAttachments.id, attachmentId),
        eq(candidateAttachments.candidateId, candidateId),
        eq(candidateAttachments.tenantId, actor.tenantId),
      ),
    );
  if (!att || !att.uploadedAt) throw new AttachmentNotFoundError();

  // Obsoletos sólo para manager/admin.
  if (
    att.isObsolete &&
    actor.role !== "manager" &&
    actor.role !== "admin"
  ) {
    throw new AttachmentForbiddenError();
  }

  const obj = await bucket.get(att.storageKey);
  if (!obj || !obj.body) throw new AttachmentNotFoundError();

  return {
    body: obj.body,
    contentType: att.mimeType,
    fileName: att.fileName,
  };
}

export async function setAttachmentObsolete(
  db: Database,
  actor: ActorContext,
  candidateId: string,
  attachmentId: string,
  isObsolete: boolean,
): Promise<CandidateAttachmentRow> {
  const [cand] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, candidateId),
        eq(candidates.tenantId, actor.tenantId),
      ),
    );
  if (!cand) throw new CandidateNotFoundError();
  if (!(await actorCanEditCandidate(db, actor, cand))) {
    throw new AttachmentForbiddenError();
  }

  const [att] = await db
    .select()
    .from(candidateAttachments)
    .where(
      and(
        eq(candidateAttachments.id, attachmentId),
        eq(candidateAttachments.candidateId, candidateId),
      ),
    );
  if (!att) throw new AttachmentNotFoundError();

  const [updated] = await db
    .update(candidateAttachments)
    .set({ isObsolete, updatedAt: new Date() })
    .where(eq(candidateAttachments.id, attachmentId))
    .returning();

  if (att.isObsolete !== isObsolete && isObsolete) {
    await recordAuditEvent(db, {
      tenantId: actor.tenantId,
      actorId: actor.actorId,
      action: "candidate.attachment.obsoleted",
      targetType: "candidate",
      targetId: candidateId,
      oldValues: { is_obsolete: att.isObsolete },
      newValues: { is_obsolete: isObsolete },
    });
  }

  return updated;
}

// ----- US5: Categorías (rejection / decline) -----
import type { CategoryCreateInput, CategoryUpdateInput } from "@bepro/shared";

type CategoryTable = typeof rejectionCategories | typeof declineCategories;

function categoryTableFor(kind: "rejection" | "decline"): CategoryTable {
  return kind === "rejection" ? rejectionCategories : declineCategories;
}

export async function listCategories(
  db: Database,
  tenantId: string,
  kind: "rejection" | "decline",
): Promise<Array<{ id: string; label: string; is_active: boolean }>> {
  const table = categoryTableFor(kind);
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.tenantId, tenantId))
    .orderBy(table.label);
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    is_active: r.isActive,
  }));
}

export async function createCategory(
  db: Database,
  tenantId: string,
  kind: "rejection" | "decline",
  input: CategoryCreateInput,
): Promise<{ id: string; label: string; is_active: boolean }> {
  const table = categoryTableFor(kind);
  const [row] = await db
    .insert(table)
    .values({ tenantId, label: input.label })
    .returning();
  return { id: row.id, label: row.label, is_active: row.isActive };
}

export async function updateCategory(
  db: Database,
  tenantId: string,
  kind: "rejection" | "decline",
  id: string,
  input: CategoryUpdateInput,
): Promise<{ id: string; label: string; is_active: boolean } | null> {
  const table = categoryTableFor(kind);
  const updates: Record<string, unknown> = {};
  if (input.label !== undefined) updates.label = input.label;
  if (input.is_active !== undefined) updates.isActive = input.is_active;
  updates.updatedAt = new Date();

  const [row] = await db
    .update(table)
    .set(updates)
    .where(and(eq(table.id, id), eq(table.tenantId, tenantId)))
    .returning();
  if (!row) return null;
  return { id: row.id, label: row.label, is_active: row.isActive };
}

// ----- US6: PATCH PII -----
import type { UpdateCandidatePiiInput } from "@bepro/shared";

export class CandidateEditForbiddenError extends Error {
  readonly code = "edit_forbidden" as const;
  constructor() {
    super("No tienes permisos para editar este candidato.");
    this.name = "CandidateEditForbiddenError";
  }
}

const PII_FIELD_MAP: Record<
  keyof UpdateCandidatePiiInput,
  keyof typeof candidates.$inferSelect | null
> = {
  first_name: "firstName",
  last_name: "lastName",
  phone: "phone",
  email: "email",
  current_position: "currentPosition",
  source: "source",
  additional_fields: null, // JSONB merge; sin diff campo a campo
};

export async function updateCandidatePii(
  db: Database,
  actor: ActorContext,
  candidateId: string,
  input: UpdateCandidatePiiInput,
): Promise<ICandidateDetail> {
  const [cand] = await db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.id, candidateId),
        eq(candidates.tenantId, actor.tenantId),
      ),
    );
  if (!cand) throw new CandidateNotFoundError();
  if (!(await actorCanEditCandidate(db, actor, cand))) {
    throw new CandidateEditForbiddenError();
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const auditWrites: Array<{
    field: keyof UpdateCandidatePiiInput;
    oldValue: unknown;
    newValue: unknown;
  }> = [];

  for (const field of Object.keys(PII_FIELD_MAP) as Array<
    keyof UpdateCandidatePiiInput
  >) {
    const value = input[field];
    if (value === undefined) continue;

    if (field === "additional_fields") {
      const merged = {
        ...((cand.additionalFields ?? {}) as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
      updates.additionalFields = merged;
      auditWrites.push({
        field,
        oldValue: "[redacted]",
        newValue: "[merged]",
      });
      continue;
    }

    const dbCol = PII_FIELD_MAP[field]!;
    const oldValue = (cand as Record<string, unknown>)[dbCol];
    if (oldValue === value) continue;
    updates[dbCol] = value;
    if (field === "phone") {
      updates.phoneNormalized = normalizePhone(value as string);
    }
    auditWrites.push({ field, oldValue, newValue: value });
  }

  const [updated] = await db
    .update(candidates)
    .set(updates)
    .where(eq(candidates.id, candidateId))
    .returning();

  // Una fila de audit por campo modificado (FR-061).
  for (const w of auditWrites) {
    await recordAuditEvent(db, {
      tenantId: actor.tenantId,
      actorId: actor.actorId,
      action: "candidate.field.edited",
      targetType: "candidate",
      targetId: candidateId,
      oldValues: { [w.field]: w.oldValue },
      newValues: { [w.field]: w.newValue },
    });
  }

  const [client] = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, updated.clientId));
  const [recruiter] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, updated.registeringUserId));

  return toCandidateDetail(
    updated,
    { id: client?.id ?? updated.clientId, name: client?.name ?? "—" },
    {
      id: updated.registeringUserId,
      display_name: recruiter
        ? `${recruiter.firstName} ${recruiter.lastName}`.trim()
        : "—",
    },
  );
}

// ----- FR-003a: Retention reviews -----

import { retentionReviews } from "@bepro/db";

export async function getRetentionReviewStatus(
  db: Database,
  tenantId: string,
): Promise<{
  next_due_at: string;
  days_remaining: number;
  status: "ok" | "due_soon" | "overdue";
  last_review: { id: string; reviewer_user_id: string; reviewed_at: string } | null;
}> {
  const [last] = await db
    .select()
    .from(retentionReviews)
    .where(eq(retentionReviews.tenantId, tenantId))
    .orderBy(desc(retentionReviews.reviewedAt))
    .limit(1);

  // Si no hay reviews previos, usar now() como base (vence en 12 meses; status "due_soon").
  const now = Date.now();
  const nextDue = last?.nextDueAt ?? new Date(now);
  const daysRemaining = Math.floor((nextDue.getTime() - now) / (1000 * 60 * 60 * 24));

  let status: "ok" | "due_soon" | "overdue";
  if (daysRemaining < 0) status = "overdue";
  else if (daysRemaining <= 30) status = "due_soon";
  else status = "ok";

  return {
    next_due_at: nextDue.toISOString(),
    days_remaining: daysRemaining,
    status,
    last_review: last
      ? {
          id: last.id,
          reviewer_user_id: last.reviewerUserId,
          reviewed_at: last.reviewedAt.toISOString(),
        }
      : null,
  };
}

export async function createRetentionReview(
  db: Database,
  actor: ActorContext,
  input: { justification_text: string },
): Promise<{ id: string; next_due_at: string }> {
  if (actor.role !== "admin") {
    throw new CandidateEditForbiddenError();
  }
  const now = new Date();
  const nextDue = new Date(now);
  nextDue.setMonth(nextDue.getMonth() + 12);

  const [row] = await db
    .insert(retentionReviews)
    .values({
      tenantId: actor.tenantId,
      reviewerUserId: actor.actorId,
      reviewedAt: now,
      nextDueAt: nextDue,
      justificationText: input.justification_text,
    })
    .returning();

  return { id: row.id, next_due_at: row.nextDueAt.toISOString() };
}
