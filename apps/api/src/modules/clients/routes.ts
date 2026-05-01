import { Hono } from "hono";
import {
  createClientSchema,
  updateClientSchema,
  listClientsQuerySchema,
  assignUserSchema,
  createContactSchema,
  updateContactSchema,
  createPositionSchema,
  updatePositionSchema,
  batchAssignmentsSchema,
  createFormConfigFieldSchema,
  patchFormConfigFieldSchema,
} from "@bepro/shared";
import type { HonoEnv } from "../../types.js";
import { zValidator } from "../../lib/validator.js";
import {
  authMiddleware,
  tenantMiddleware,
  requireRole,
} from "../auth/middleware.js";
import {
  createClient,
  listClients,
  getClientById,
  updateClient,
  verifyClientAccess,
  verifyClientWriteAccess,
  createAssignment,
  listAssignments,
  deleteAssignment,
  batchAssignClient,
  BatchAssignmentValidationError,
  createFormConfigField,
  patchFormConfigField,
  ClientNotFoundError,
  FormConfigFieldNotFoundError,
  FormConfigFieldDuplicateKeyError,
  FormConfigFieldImmutableError,
  createContact,
  listContacts,
  updateContact,
  deleteContact,
  createPosition,
  listPositions,
  getPosition,
  updatePosition,
  deletePosition,
  InvalidAgeRangeError,
  // 011 / US2 — position documents
  createPositionDocumentRecord,
  uploadPositionDocumentBytes,
  getPositionDocumentForDownload,
  softDeletePositionDocument,
  listArchivedPositionDocuments,
  PositionDocumentNotFoundError,
  PositionDocumentMimeError,
  PositionDocumentSizeError,
} from "./service.js";
import { createPositionDocumentSchema } from "@bepro/shared";

export const clientsRoutes = new Hono<HonoEnv>();

// Middleware común: auth + tenant en todas las rutas
clientsRoutes.use("*", authMiddleware, tenantMiddleware);

// ========================================
// Client CRUD
// ========================================

// POST /clients — Crear cliente (solo admin)
clientsRoutes.post(
  "/",
  requireRole("admin"),
  zValidator("json", createClientSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const body = c.req.valid("json");

    const result = await createClient(db, tenantId, user.id, body);
    return c.json({ data: result }, 201);
  },
);

// GET /clients — Listar clientes (paginado, filtrado por rol)
clientsRoutes.get(
  "/",
  zValidator("query", listClientsQuerySchema),
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const query = c.req.valid("query");

    const result = await listClients(db, user.id, user.role, query);
    return c.json(result);
  },
);

// GET /clients/:id — Detalle de cliente
clientsRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const clientId = c.req.param("id");

  const hasAccess = await verifyClientAccess(db, user.id, user.role, clientId);
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const client = await getClientById(db, clientId);
  if (!client) {
    return c.json({ error: "Cliente no encontrado" }, 404);
  }

  // Cargar sub-recursos para el detalle
  const [contacts, positions, assignments] = await Promise.all([
    listContacts(db, clientId),
    listPositions(db, clientId),
    listAssignments(db, clientId),
  ]);

  return c.json({
    data: { ...client, contacts, positions, assignments },
  });
});

// PATCH /clients/:id — Actualizar cliente (solo admin)
clientsRoutes.patch(
  "/:id",
  requireRole("admin"),
  zValidator("json", updateClientSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("id");
    const body = c.req.valid("json");

    const result = await updateClient(db, tenantId, user.id, clientId, body);
    if (!result) {
      return c.json({ error: "Cliente no encontrado" }, 404);
    }

    return c.json({ data: result });
  },
);

// ========================================
// Assignments
// ========================================

// POST /clients/:clientId/assignments — Asignar usuario (solo admin)
clientsRoutes.post(
  "/:clientId/assignments",
  requireRole("admin"),
  zValidator("json", assignUserSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const body = c.req.valid("json");

    try {
      const result = await createAssignment(
        db,
        tenantId,
        user.id,
        clientId,
        body.userId,
        body.accountExecutiveId,
      );
      return c.json({ data: result }, 201);
    } catch (err) {
      const message = (err as Error).message;
      if (message === "USER_INACTIVE") {
        return c.json({ error: "El usuario está inactivo" }, 400);
      }
      if (message === "ALREADY_ASSIGNED") {
        return c.json({ error: "El usuario ya está asignado a este cliente" }, 409);
      }
      throw err;
    }
  },
);

// GET /clients/:clientId/assignments — Listar asignaciones
clientsRoutes.get("/:clientId/assignments", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const clientId = c.req.param("clientId");

  const hasAccess = await verifyClientAccess(db, user.id, user.role, clientId);
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await listAssignments(db, clientId);
  return c.json({ data: result });
});

// DELETE /clients/:clientId/assignments/:id — Eliminar asignación (solo admin)
clientsRoutes.delete(
  "/:clientId/assignments/:id",
  requireRole("admin"),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const assignmentId = c.req.param("id");

    const deleted = await deleteAssignment(db, tenantId, user.id, assignmentId);
    if (!deleted) {
      return c.json({ error: "Asignación no encontrada" }, 404);
    }

    return c.body(null, 204);
  },
);

// POST /clients/:clientId/assignments/batch — 008 US5 / FR-AS-002..005
// Atomic diff: sets the full list of account_executive assignments for the
// client in one transaction. Admin or manager only.
clientsRoutes.post(
  "/:clientId/assignments/batch",
  requireRole("admin", "manager"),
  zValidator("json", batchAssignmentsSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const body = c.req.valid("json");

    try {
      const result = await batchAssignClient(
        db,
        tenantId,
        user.id,
        clientId,
        body,
      );
      return c.json(result);
    } catch (err) {
      if (err instanceof BatchAssignmentValidationError) {
        const messages: Record<BatchAssignmentValidationError["code"], string> = {
          user_not_found: "Uno o más userIds no existen en este tenant.",
          user_inactive: "Uno o más usuarios están inactivos.",
          invalid_role:
            "Usuarios con rol admin/manager no pueden asignarse a clientes; sólo account_executive o recruiter.",
          recruiter_leader_not_in_set:
            "accountExecutiveId de un reclutador no está en la lista de AEs deseados.",
          recruiter_leader_not_ae:
            "accountExecutiveId apunta a un usuario que no es account_executive.",
        };
        return c.json(
          {
            error: err.code,
            message: messages[err.code],
            offenders: err.offenders,
          },
          422,
        );
      }
      if ((err as Error).message === "CLIENT_NOT_FOUND") {
        return c.json({ error: "Cliente no encontrado" }, 404);
      }
      throw err;
    }
  },
);

// ========================================
// Form-config custom fields (008 US6)
// ========================================

// POST /clients/:clientId/form-config/fields — admin only, create a field.
clientsRoutes.post(
  "/:clientId/form-config/fields",
  requireRole("admin"),
  zValidator("json", createFormConfigFieldSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const body = c.req.valid("json");

    try {
      const field = await createFormConfigField(db, tenantId, user.id, clientId, {
        key: body.key,
        label: body.label,
        type: body.type,
        required: body.required,
        options: body.options ?? null,
      });
      return c.json({ clientId, field }, 201);
    } catch (err) {
      if (err instanceof ClientNotFoundError) {
        return c.json({ error: "not_found", message: "Cliente no encontrado." }, 404);
      }
      if (err instanceof FormConfigFieldDuplicateKeyError) {
        return c.json(
          {
            error: "duplicate_key",
            message: `La clave '${err.key}' ya existe en la configuración de este cliente.`,
          },
          409,
        );
      }
      throw err;
    }
  },
);

// PATCH /clients/:clientId/form-config/fields/:key — update / archive / unarchive.
clientsRoutes.patch(
  "/:clientId/form-config/fields/:key",
  requireRole("admin"),
  zValidator("json", patchFormConfigFieldSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const key = c.req.param("key");
    const body = c.req.valid("json");

    try {
      const field = await patchFormConfigField(
        db,
        tenantId,
        user.id,
        clientId,
        key,
        body,
      );
      return c.json({ clientId, field });
    } catch (err) {
      if (err instanceof ClientNotFoundError) {
        return c.json({ error: "not_found", message: "Cliente no encontrado." }, 404);
      }
      if (err instanceof FormConfigFieldNotFoundError) {
        return c.json(
          { error: "field_not_found", message: "Campo no encontrado." },
          404,
        );
      }
      if (err instanceof FormConfigFieldImmutableError) {
        return c.json(
          {
            error: "immutable_field",
            message: `No puedes modificar '${err.attemptedField}' de un campo existente.`,
          },
          422,
        );
      }
      throw err;
    }
  },
);

// ========================================
// Contacts
// ========================================

// POST /clients/:clientId/contacts — Crear contacto (admin o AE asignado)
clientsRoutes.post(
  "/:clientId/contacts",
  zValidator("json", createContactSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const body = c.req.valid("json");

    const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
    if (!hasWriteAccess) {
      return c.json({ error: "Forbidden" }, 403);
    }

    try {
      const result = await createContact(db, tenantId, user.id, clientId, body);
      return c.json({ data: result }, 201);
    } catch (err) {
      // Unique constraint violation en email por cliente
      if ((err as Error).message?.includes("unique") || (err as Error).message?.includes("duplicate")) {
        return c.json({ error: "Ya existe un contacto con este correo electrónico en este cliente" }, 409);
      }
      throw err;
    }
  },
);

// GET /clients/:clientId/contacts — Listar contactos
clientsRoutes.get("/:clientId/contacts", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const clientId = c.req.param("clientId");

  const hasAccess = await verifyClientAccess(db, user.id, user.role, clientId);
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await listContacts(db, clientId);
  return c.json({ data: result });
});

// PATCH /clients/:clientId/contacts/:id — Actualizar contacto
clientsRoutes.patch(
  "/:clientId/contacts/:id",
  zValidator("json", updateContactSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const contactId = c.req.param("id");

    const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
    if (!hasWriteAccess) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const result = await updateContact(db, tenantId, user.id, contactId, c.req.valid("json"));
    if (!result) {
      return c.json({ error: "Contacto no encontrado" }, 404);
    }

    return c.json({ data: result });
  },
);

// DELETE /clients/:clientId/contacts/:id — Eliminar contacto (hard delete)
clientsRoutes.delete("/:clientId/contacts/:id", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const contactId = c.req.param("id");

  const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
  if (!hasWriteAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const deleted = await deleteContact(db, tenantId, user.id, contactId);
  if (!deleted) {
    return c.json({ error: "Contacto no encontrado" }, 404);
  }

  return c.body(null, 204);
});

// ========================================
// Positions
// ========================================

// POST /clients/:clientId/positions — Crear puesto (perfil completo)
// Roles: admin, manager, account_executive (+ verifyClientWriteAccess para AE).
clientsRoutes.post(
  "/:clientId/positions",
  requireRole("admin", "manager", "account_executive"),
  zValidator("json", createPositionSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const body = c.req.valid("json");

    const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
    if (!hasWriteAccess) {
      return c.json({ error: "Forbidden" }, 403);
    }

    try {
      const result = await createPosition(db, tenantId, user.id, clientId, body);
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err instanceof InvalidAgeRangeError) {
        return c.json(
          {
            error: {
              code: "invalid_age_range",
              message:
                "El rango de edad mínimo no puede ser mayor que el máximo.",
            },
          },
          400,
        );
      }
      if ((err as Error).message === "POSITION_DUPLICATE") {
        return c.json({ error: "Ya existe un puesto con este nombre en este cliente" }, 409);
      }
      throw err;
    }
  },
);

// GET /clients/:clientId/positions — Listar puestos
clientsRoutes.get("/:clientId/positions", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const clientId = c.req.param("clientId");

  const hasAccess = await verifyClientAccess(db, user.id, user.role, clientId);
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const includeInactive = c.req.query("includeInactive") === "true";
  const result = await listPositions(db, clientId, includeInactive);
  return c.json({ data: result });
});

// GET /clients/:clientId/positions/:posId — Detalle de puesto (perfil + summary docs)
// 404 uniforme para cross-tenant / no asignado (FR-016).
clientsRoutes.get("/:clientId/positions/:posId", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const positionId = c.req.param("posId");

  const hasAccess = await verifyClientAccess(db, user.id, user.role, clientId);
  if (!hasAccess) {
    return c.json({ error: "Puesto no encontrado" }, 404);
  }

  const result = await getPosition(db, clientId, positionId);
  if (!result) {
    return c.json({ error: "Puesto no encontrado" }, 404);
  }
  return c.json({ data: result });
});

// PATCH /clients/:clientId/positions/:posId — Actualizar puesto (parcial)
clientsRoutes.patch(
  "/:clientId/positions/:posId",
  requireRole("admin", "manager", "account_executive"),
  zValidator("json", updatePositionSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const positionId = c.req.param("posId");

    const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
    if (!hasWriteAccess) {
      return c.json({ error: "Forbidden" }, 403);
    }

    try {
      const result = await updatePosition(db, tenantId, user.id, positionId, c.req.valid("json"));
      if (!result) {
        return c.json({ error: "Puesto no encontrado" }, 404);
      }
      return c.json({ data: result });
    } catch (err) {
      if (err instanceof InvalidAgeRangeError) {
        return c.json(
          {
            error: {
              code: "invalid_age_range",
              message:
                "El rango de edad mínimo no puede ser mayor que el máximo.",
            },
          },
          400,
        );
      }
      if ((err as Error).message === "POSITION_DUPLICATE") {
        return c.json({ error: "Ya existe un puesto con este nombre en este cliente" }, 409);
      }
      throw err;
    }
  },
);

// ========================================
// Position Documents (011 / US2)
// ========================================

// POST /:clientId/positions/:posId/documents — crear registro (step 1 de 2)
clientsRoutes.post(
  "/:clientId/positions/:posId/documents",
  requireRole("admin", "manager", "account_executive"),
  zValidator("json", createPositionDocumentSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const positionId = c.req.param("posId");
    const body = c.req.valid("json");

    const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
    if (!hasWriteAccess) {
      return c.json({ error: "Forbidden" }, 403);
    }
    try {
      const result = await createPositionDocumentRecord(
        db,
        tenantId,
        user.id,
        clientId,
        positionId,
        body,
      );
      return c.json({ data: result }, 201);
    } catch (err) {
      if (err instanceof PositionDocumentNotFoundError) {
        return c.json({ error: "Puesto no encontrado" }, 404);
      }
      if (err instanceof PositionDocumentMimeError) {
        return c.json(
          {
            error: {
              code: "invalid_mime",
              message: "Tipo de archivo no permitido. Sólo PDF, DOC, DOCX.",
            },
          },
          422,
        );
      }
      if (err instanceof PositionDocumentSizeError) {
        return c.json(
          {
            error: {
              code: "file_too_large",
              message: "El archivo excede el límite de 10 MB.",
            },
          },
          422,
        );
      }
      throw err;
    }
  },
);

// POST /:clientId/positions/:posId/documents/:docId/upload — subir bytes
clientsRoutes.post(
  "/:clientId/positions/:posId/documents/:docId/upload",
  requireRole("admin", "manager", "account_executive"),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const positionId = c.req.param("posId");
    const documentId = c.req.param("docId");

    const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
    if (!hasWriteAccess) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const contentType = c.req.header("Content-Type") ?? "";
    const contentLengthHdr = c.req.header("Content-Length");
    const declaredSize = contentLengthHdr ? Number(contentLengthHdr) : NaN;
    if (!Number.isNaN(declaredSize) && declaredSize > 10 * 1024 * 1024) {
      return c.json(
        {
          error: {
            code: "file_too_large",
            message: "El archivo excede el límite de 10 MB.",
          },
        },
        422,
      );
    }

    const body = await c.req.arrayBuffer();
    try {
      const dto = await uploadPositionDocumentBytes(
        db,
        tenantId,
        user.id,
        c.env.FILES,
        clientId,
        positionId,
        documentId,
        body,
        contentType,
      );
      return c.json({ data: dto });
    } catch (err) {
      if (err instanceof PositionDocumentNotFoundError) {
        return c.json({ error: "Documento no encontrado" }, 404);
      }
      if (err instanceof PositionDocumentMimeError) {
        return c.json(
          {
            error: {
              code: "invalid_mime",
              message: "Tipo de archivo no permitido.",
            },
          },
          422,
        );
      }
      if (err instanceof PositionDocumentSizeError) {
        return c.json(
          {
            error: {
              code: "file_too_large",
              message: "El archivo excede el límite de 10 MB.",
            },
          },
          422,
        );
      }
      throw err;
    }
  },
);

// GET /:clientId/positions/:posId/documents/:docId/download — stream
clientsRoutes.get(
  "/:clientId/positions/:posId/documents/:docId/download",
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const positionId = c.req.param("posId");
    const documentId = c.req.param("docId");

    const hasAccess = await verifyClientAccess(db, user.id, user.role, clientId);
    if (!hasAccess) {
      // Uniform 404 (FR-016)
      return c.json({ error: "Documento no encontrado" }, 404);
    }

    // Recruiter sin asignación al cliente — `verifyClientAccess` arriba ya
    // bloqueó (404). Aquí cubrimos los demás casos (archivado para no-admin,
    // posición inactiva, etc.) en el service.
    const stream = await getPositionDocumentForDownload(
      db,
      c.env.FILES,
      clientId,
      positionId,
      documentId,
      user.role,
    );
    if (!stream) {
      return c.json({ error: "Documento no encontrado" }, 404);
    }

    return new Response(stream.body, {
      headers: {
        "Content-Type": stream.contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(stream.filename)}"`,
        "Content-Length": stream.contentLength.toString(),
      },
    });
  },
);

// DELETE /:clientId/positions/:posId/documents/:docId — soft-delete (admin)
clientsRoutes.delete(
  "/:clientId/positions/:posId/documents/:docId",
  requireRole("admin"),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const positionId = c.req.param("posId");
    const documentId = c.req.param("docId");

    const ok = await softDeletePositionDocument(
      db,
      tenantId,
      user.id,
      clientId,
      positionId,
      documentId,
    );
    if (!ok) return c.json({ error: "Documento no encontrado" }, 404);
    return c.body(null, 204);
  },
);

// GET /:clientId/positions/:posId/documents/history — versiones (admin only, FR-018)
clientsRoutes.get(
  "/:clientId/positions/:posId/documents/history",
  requireRole("admin"),
  async (c) => {
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const positionId = c.req.param("posId");
    const typeQ = c.req.query("type");

    const validType =
      typeQ === "contract" || typeQ === "pase_visita" ? typeQ : undefined;

    const rows = await listArchivedPositionDocuments(
      db,
      clientId,
      positionId,
      validType,
    );
    return c.json({ data: rows });
  },
);

// DELETE /clients/:clientId/positions/:posId — Eliminar puesto
clientsRoutes.delete("/:clientId/positions/:posId", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const positionId = c.req.param("posId");

  const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
  if (!hasWriteAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const deleted = await deletePosition(db, tenantId, user.id, positionId);
  if (!deleted) {
    return c.json({ error: "Puesto no encontrado" }, 404);
  }

  return c.body(null, 204);
});

// ========================================
// Legacy Client Documents (011 / US3 — endpoints removidos)
//
// Mantener las rutas registradas (en lugar de borrarlas) para que un cliente
// stale obtenga 410 Gone con un mensaje accionable, en vez de 404.
// ========================================

const LEGACY_GONE_BODY = {
  error: {
    code: "endpoint_removed",
    message:
      "Endpoint removido en feature 011 — los documentos viven ahora en cada puesto.",
  },
};

clientsRoutes.post("/:clientId/documents", (c) => c.json(LEGACY_GONE_BODY, 410));
clientsRoutes.get("/:clientId/documents", (c) => c.json(LEGACY_GONE_BODY, 410));
clientsRoutes.get("/:clientId/documents/:id/download", (c) =>
  c.json(LEGACY_GONE_BODY, 410),
);
clientsRoutes.delete("/:clientId/documents/:id", (c) =>
  c.json(LEGACY_GONE_BODY, 410),
);
