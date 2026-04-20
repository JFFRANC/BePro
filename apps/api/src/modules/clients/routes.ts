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
  documentTypeSchema,
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
  createContact,
  listContacts,
  updateContact,
  deleteContact,
  createPosition,
  listPositions,
  updatePosition,
  deletePosition,
  createDocumentRecord,
  listDocuments,
  getDocumentById,
  deleteDocumentRecord,
} from "./service.js";

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

// POST /clients/:clientId/positions — Crear puesto
clientsRoutes.post(
  "/:clientId/positions",
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

// PATCH /clients/:clientId/positions/:id — Actualizar puesto
clientsRoutes.patch(
  "/:clientId/positions/:id",
  zValidator("json", updatePositionSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const clientId = c.req.param("clientId");
    const positionId = c.req.param("id");

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
      if ((err as Error).message === "POSITION_DUPLICATE") {
        return c.json({ error: "Ya existe un puesto con este nombre en este cliente" }, 409);
      }
      throw err;
    }
  },
);

// DELETE /clients/:clientId/positions/:id — Eliminar puesto
clientsRoutes.delete("/:clientId/positions/:id", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const positionId = c.req.param("id");

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
// Documents
// ========================================

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  quotation: ["application/pdf"],
  interview_pass: ["image/png"],
  position_description: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// POST /clients/:clientId/documents — Subir documento (multipart)
clientsRoutes.post("/:clientId/documents", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const clientId = c.req.param("clientId");

  const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
  if (!hasWriteAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const formData = await c.req.formData();
  const file = formData.get("file");
  const documentType = formData.get("documentType");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "El archivo es requerido" }, 400);
  }

  const typeResult = documentTypeSchema.safeParse(documentType);
  if (!typeResult.success) {
    return c.json({ error: "Tipo de documento inválido. Valores válidos: quotation, interview_pass, position_description" }, 400);
  }

  const docType = typeResult.data;

  // Validar MIME type
  const allowedMimes = ALLOWED_MIME_TYPES[docType];
  if (!allowedMimes.includes(file.type)) {
    return c.json(
      { error: `Tipo de archivo no permitido para ${docType}. Tipos permitidos: ${allowedMimes.join(", ")}` },
      415,
    );
  }

  // Validar tamaño
  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "El archivo excede el tamaño máximo de 10 MB" }, 413);
  }

  // Subir a R2
  const storageKey = `clients/${clientId}/documents/${crypto.randomUUID()}-${file.name}`;
  const fileBuffer = await file.arrayBuffer();

  await c.env.FILES.put(storageKey, fileBuffer, {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: file.name, documentType: docType },
  });

  // Registrar en DB
  const record = await createDocumentRecord(db, tenantId, user.id, clientId, {
    originalName: file.name,
    documentType: docType,
    mimeType: file.type,
    sizeBytes: file.size,
    storageKey,
  });

  return c.json({
    data: {
      id: record.id,
      originalName: record.originalName,
      documentType: record.documentType,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      uploadedBy: record.uploadedBy,
      createdAt: record.createdAt.toISOString(),
    },
  }, 201);
});

// GET /clients/:clientId/documents — Listar documentos
clientsRoutes.get("/:clientId/documents", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const clientId = c.req.param("clientId");

  const hasAccess = await verifyClientAccess(db, user.id, user.role, clientId);
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const result = await listDocuments(db, clientId);
  return c.json({ data: result });
});

// GET /clients/:clientId/documents/:id/download — Descargar documento
clientsRoutes.get("/:clientId/documents/:id/download", async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const documentId = c.req.param("id");

  const hasAccess = await verifyClientAccess(db, user.id, user.role, clientId);
  if (!hasAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const doc = await getDocumentById(db, documentId);
  if (!doc || doc.clientId !== clientId) {
    return c.json({ error: "Documento no encontrado" }, 404);
  }

  const object = await c.env.FILES.get(doc.storageKey);
  if (!object) {
    return c.json({ error: "Archivo no encontrado en almacenamiento" }, 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.originalName)}"`,
      "Content-Length": doc.sizeBytes.toString(),
    },
  });
});

// DELETE /clients/:clientId/documents/:id — Eliminar documento
clientsRoutes.delete("/:clientId/documents/:id", async (c) => {
  const user = c.get("user");
  const tenantId = c.get("tenantId");
  const db = c.get("db");
  const clientId = c.req.param("clientId");
  const documentId = c.req.param("id");

  const hasWriteAccess = await verifyClientWriteAccess(db, user.id, user.role, clientId);
  if (!hasWriteAccess) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const deleted = await deleteDocumentRecord(db, tenantId, user.id, documentId);
  if (!deleted) {
    return c.json({ error: "Documento no encontrado" }, 404);
  }

  // Eliminar de R2
  await c.env.FILES.delete(deleted.storageKey);

  return c.body(null, 204);
});
