// 007-candidates-module — router Hono.
import { Hono } from "hono";
import {
  registerCandidateRequestSchema,
  duplicateProbeQuerySchema,
  listCandidatesQuerySchema,
  transitionRequestSchema,
  reactivateRequestSchema,
  attachmentInitSchema,
  attachmentObsoleteSchema,
  updateCandidatePiiSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  retentionReviewCreateSchema,
} from "@bepro/shared";
import type { HonoEnv } from "../../types.js";
import { zValidator } from "../../lib/validator.js";
import { authMiddleware, tenantMiddleware } from "../auth/middleware.js";
import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { users as usersTable } from "@bepro/db";
import {
  AttachmentForbiddenError,
  AttachmentNotFoundError,
  CandidateEditForbiddenError,
  CandidateNotFoundError,
  ClientNotFoundError,
  DuplicatesDetectedError,
  FormConfigValidationError,
  InvalidReactivationError,
  PrivacyNoticeMismatchError,
  StaleStatusError,
  createCandidate,
  createCategory,
  createRetentionReview,
  getActivePrivacyNotice,
  getAttachmentDownload,
  getCandidateById,
  getRetentionReviewStatus,
  initAttachment,
  listAttachments,
  listCandidates,
  listCategories,
  probeDuplicates,
  reactivateCandidate,
  setAttachmentObsolete,
  transitionCandidate,
  updateCandidatePii,
  updateCategory,
  uploadAttachment,
} from "./service.js";
import { TransitionError } from "./fsm.js";
import { redactCandidate } from "./redact.js";

export const candidatesRoutes = new Hono<HonoEnv>();

// Auth + tenant (RLS via SET LOCAL) en todas las rutas del módulo.
candidatesRoutes.use("*", authMiddleware, tenantMiddleware);

// 008-ux-roles-refinements / US2 — Only recruiters (including freelancer
// recruiters) may register candidates (FR-CG-001). Returns the spec-contract
// 403 body shape on rejection, and also blocks inactive/terminated recruiters
// (edge case L168) with a dedicated message.
const requireActiveRecruiter: MiddlewareHandler<HonoEnv> = async (c, next) => {
  const user = c.get("user");
  if (user.role !== "recruiter") {
    return c.json(
      {
        error: "forbidden",
        message: "Solo reclutadores pueden registrar candidatos.",
      },
      403,
    );
  }
  const db = c.get("db");
  const [row] = await db
    .select({ isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, user.id));
  if (!row || !row.isActive) {
    return c.json(
      {
        error: "forbidden",
        message: "Reclutador inactivo no puede registrar candidatos.",
      },
      403,
    );
  }
  await next();
};

// Endpoint de salud (módulo montado).
candidatesRoutes.get("/_ping", (c) =>
  c.json({ module: "candidates", ok: true }),
);

// GET /api/candidates/privacy-notice/active — devuelve el aviso activo del tenant.
candidatesRoutes.get("/privacy-notice/active", async (c) => {
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const notice = await getActivePrivacyNotice(db, tenantId);
  if (!notice) {
    return c.json(
      { code: "no_active_notice", message: "No hay aviso de privacidad activo para este tenant." },
      404,
    );
  }
  return c.json({ privacy_notice: notice });
});

// GET /api/candidates/duplicates?client_id=...&phone=... — sondeo previo (US1, contracts §10).
candidatesRoutes.get(
  "/duplicates",
  zValidator("query", duplicateProbeQuerySchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const query = c.req.valid("query");
    const duplicates = await probeDuplicates(db, tenantId, query);
    return c.json({ duplicates });
  },
);

// GET /api/candidates — Listado role-scoped + filtros (US2, contracts §2).
candidatesRoutes.get(
  "/",
  zValidator("query", listCandidatesQuerySchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const query = c.req.valid("query");
    const result = await listCandidates(
      db,
      { tenantId, actorId: user.id, role: user.role },
      query,
    );
    return c.json(result);
  },
);

// GET /api/candidates/:id — Detalle (US2, contracts §3). 404 si fuera de scope.
candidatesRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const id = c.req.param("id");
  const result = await getCandidateById(
    db,
    { tenantId, actorId: user.id, role: user.role },
    id,
  );
  if (!result) {
    return c.json(
      { code: "not_found", message: "Candidato no encontrado." },
      404,
    );
  }
  return c.json(result);
});

// PATCH /api/candidates/:id — Editar PII y additional_fields (US6 / FR-061, contracts §4).
candidatesRoutes.patch(
  "/:id",
  zValidator("json", updateCandidatePiiSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    try {
      const candidate = await updateCandidatePii(
        db,
        { tenantId, actorId: user.id, role: user.role },
        id,
        input,
      );
      return c.json({ candidate });
    } catch (err) {
      if (err instanceof CandidateNotFoundError) {
        return c.json({ code: err.code, message: err.message }, 404);
      }
      if (err instanceof CandidateEditForbiddenError) {
        // Mascarado como 404 (no enumeration).
        return c.json(
          { code: "not_found", message: "Candidato no encontrado." },
          404,
        );
      }
      throw err;
    }
  },
);

// ----- Attachments (US4) -----

candidatesRoutes.get("/:id/attachments", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const id = c.req.param("id");
  const includeObsolete = c.req.query("include_obsolete") === "true";
  try {
    const items = await listAttachments(
      db,
      { tenantId, actorId: user.id, role: user.role },
      id,
      includeObsolete,
    );
    return c.json({
      attachments: items.map((a) => ({
        id: a.id,
        candidate_id: a.candidateId,
        file_name: a.fileName,
        mime_type: a.mimeType,
        size_bytes: a.sizeBytes,
        tag: a.tag,
        is_obsolete: a.isObsolete,
        uploaded_at: a.uploadedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    if (err instanceof CandidateNotFoundError) {
      return c.json({ code: "not_found", message: "Candidato no encontrado." }, 404);
    }
    throw err;
  }
});

candidatesRoutes.post(
  "/:id/attachments",
  zValidator("json", attachmentInitSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const id = c.req.param("id");
    const input = c.req.valid("json");
    try {
      const result = await initAttachment(
        db,
        { tenantId, actorId: user.id, role: user.role },
        id,
        input,
      );
      return c.json(result);
    } catch (err) {
      if (err instanceof CandidateNotFoundError) {
        return c.json({ code: "not_found", message: "Candidato no encontrado." }, 404);
      }
      if (err instanceof AttachmentForbiddenError) {
        return c.json({ code: "not_found", message: "Candidato no encontrado." }, 404);
      }
      throw err;
    }
  },
);

candidatesRoutes.post("/:id/attachments/:attId/upload", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const id = c.req.param("id");
  const attId = c.req.param("attId");
  const body = c.req.raw.body;
  if (!body) {
    return c.json({ code: "missing_body", message: "Falta el archivo" }, 400);
  }
  try {
    const updated = await uploadAttachment(
      db,
      { tenantId, actorId: user.id, role: user.role },
      id,
      attId,
      body,
      c.env.FILES,
    );
    return c.json({
      attachment: {
        id: updated.id,
        candidate_id: updated.candidateId,
        file_name: updated.fileName,
        mime_type: updated.mimeType,
        size_bytes: updated.sizeBytes,
        tag: updated.tag,
        is_obsolete: updated.isObsolete,
        uploaded_at: updated.uploadedAt?.toISOString() ?? null,
      },
    });
  } catch (err) {
    if (err instanceof AttachmentNotFoundError || err instanceof CandidateNotFoundError) {
      return c.json({ code: "not_found", message: "Adjunto no encontrado." }, 404);
    }
    if (err instanceof AttachmentForbiddenError) {
      return c.json({ code: "not_found", message: "Adjunto no encontrado." }, 404);
    }
    throw err;
  }
});

candidatesRoutes.get("/:id/attachments/:attId/download", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const id = c.req.param("id");
  const attId = c.req.param("attId");
  try {
    const { body, contentType, fileName } = await getAttachmentDownload(
      db,
      { tenantId, actorId: user.id, role: user.role },
      id,
      attId,
      c.env.FILES,
    );
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (err) {
    if (
      err instanceof AttachmentNotFoundError ||
      err instanceof CandidateNotFoundError ||
      err instanceof AttachmentForbiddenError
    ) {
      return c.json({ code: "not_found", message: "Adjunto no encontrado." }, 404);
    }
    throw err;
  }
});

candidatesRoutes.patch(
  "/:id/attachments/:attId",
  zValidator("json", attachmentObsoleteSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const id = c.req.param("id");
    const attId = c.req.param("attId");
    const input = c.req.valid("json");
    try {
      const updated = await setAttachmentObsolete(
        db,
        { tenantId, actorId: user.id, role: user.role },
        id,
        attId,
        input.is_obsolete,
      );
      return c.json({
        attachment: {
          id: updated.id,
          is_obsolete: updated.isObsolete,
          uploaded_at: updated.uploadedAt?.toISOString() ?? null,
        },
      });
    } catch (err) {
      if (
        err instanceof AttachmentNotFoundError ||
        err instanceof CandidateNotFoundError ||
        err instanceof AttachmentForbiddenError
      ) {
        return c.json({ code: "not_found", message: "Adjunto no encontrado." }, 404);
      }
      throw err;
    }
  },
);

// POST /api/candidates/:id/transitions — Cambio de estado (US3, contracts §5).
candidatesRoutes.post(
  "/:id/transitions",
  zValidator("json", transitionRequestSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    try {
      const result = await transitionCandidate(
        db,
        { tenantId, actorId: user.id, role: user.role },
        id,
        input,
      );
      return c.json(result);
    } catch (err) {
      if (err instanceof CandidateNotFoundError) {
        return c.json({ code: err.code, message: err.message }, 404);
      }
      if (err instanceof StaleStatusError) {
        return c.json(
          {
            code: err.code,
            message: err.message,
            current_status: err.currentStatus,
          },
          409,
        );
      }
      if (err instanceof TransitionError) {
        return c.json(
          { code: err.code, message: err.message },
          err.status,
        );
      }
      throw err;
    }
  },
);

// POST /api/candidates/:id/reactivate — Reactivar (US3 / FR-038a, contracts §5a).
candidatesRoutes.post(
  "/:id/reactivate",
  zValidator("json", reactivateRequestSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const id = c.req.param("id");
    const input = c.req.valid("json");

    try {
      const result = await reactivateCandidate(
        db,
        { tenantId, actorId: user.id, role: user.role },
        id,
        input,
      );
      return c.json(result);
    } catch (err) {
      if (err instanceof CandidateNotFoundError) {
        return c.json({ code: err.code, message: err.message }, 404);
      }
      if (err instanceof InvalidReactivationError) {
        return c.json(
          { code: err.code, message: err.message },
          err.status,
        );
      }
      throw err;
    }
  },
);

// POST /api/candidates — Registrar candidato (US1, contracts §1).
// 008 US2 — requireActiveRecruiter enforces recruiter-only gate (FR-CG-001).
candidatesRoutes.post(
  "/",
  requireActiveRecruiter,
  zValidator("json", registerCandidateRequestSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const input = c.req.valid("json");

    try {
      const result = await createCandidate(
        db,
        { tenantId, actorId: user.id },
        input,
      );
      // Log seguro: sólo identificadores no-PII (FR-004).
      console.log(
        "[candidates] created",
        redactCandidate(result.candidate as never),
      );
      return c.json(result, 201);
    } catch (err) {
      if (err instanceof DuplicatesDetectedError) {
        return c.json(
          {
            code: err.code,
            message: err.message,
            duplicates: err.duplicates,
          },
          409,
        );
      }
      if (err instanceof PrivacyNoticeMismatchError) {
        return c.json({ code: err.code, message: err.message }, 422);
      }
      if (err instanceof FormConfigValidationError) {
        return c.json(
          { code: err.code, message: err.message, details: err.issues },
          422,
        );
      }
      if (err instanceof ClientNotFoundError) {
        return c.json({ code: err.code, message: err.message }, 404);
      }
      throw err;
    }
  },
);

// ----- US5: Categorías (admin CRUD) -----

function categoryRoutes(kind: "rejection" | "decline", basePath: string) {
  candidatesRoutes.get(basePath, async (c) => {
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const items = await listCategories(db, tenantId, kind);
    return c.json({ items });
  });

  candidatesRoutes.post(
    basePath,
    zValidator("json", categoryCreateSchema),
    async (c) => {
      const user = c.get("user");
      if (user.role !== "admin") {
        return c.json({ code: "not_found", message: "Recurso no encontrado." }, 404);
      }
      const tenantId = c.get("tenantId");
      const db = c.get("db");
      const input = c.req.valid("json");
      const created = await createCategory(db, tenantId, kind, input);
      return c.json({ item: created }, 201);
    },
  );

  candidatesRoutes.patch(
    `${basePath}/:id`,
    zValidator("json", categoryUpdateSchema),
    async (c) => {
      const user = c.get("user");
      if (user.role !== "admin") {
        return c.json({ code: "not_found", message: "Recurso no encontrado." }, 404);
      }
      const tenantId = c.get("tenantId");
      const db = c.get("db");
      const id = c.req.param("id");
      const updated = await updateCategory(
        db,
        tenantId,
        kind,
        id,
        c.req.valid("json"),
      );
      if (!updated) {
        return c.json({ code: "not_found", message: "Categoría no encontrada." }, 404);
      }
      return c.json({ item: updated });
    },
  );
}

categoryRoutes("rejection", "/categories/rejection");
categoryRoutes("decline", "/categories/decline");

// ----- FR-003a: Retention reviews -----

candidatesRoutes.get("/retention-reviews/status", async (c) => {
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const status = await getRetentionReviewStatus(db, tenantId);
  return c.json(status);
});

candidatesRoutes.post(
  "/retention-reviews",
  zValidator("json", retentionReviewCreateSchema),
  async (c) => {
    const user = c.get("user");
    if (user.role !== "admin") {
      return c.json({ code: "not_found", message: "Recurso no encontrado." }, 404);
    }
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const input = c.req.valid("json");
    try {
      const review = await createRetentionReview(
        db,
        { tenantId, actorId: user.id, role: user.role },
        input,
      );
      return c.json({ review }, 201);
    } catch (err) {
      if (err instanceof CandidateEditForbiddenError) {
        return c.json({ code: "not_found", message: "Recurso no encontrado." }, 404);
      }
      throw err;
    }
  },
);
