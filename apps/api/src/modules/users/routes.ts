import { Hono } from "hono";
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  changePasswordSchema,
  resetPasswordSchema,
} from "@bepro/shared";
import type { HonoEnv } from "../../types.js";
import { zValidator } from "../../lib/validator.js";
import {
  authMiddleware,
  tenantMiddleware,
  requireRole,
} from "../auth/middleware.js";
import { generateAccessToken } from "../auth/service.js";
import {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  bulkImportUsers,
  changePassword,
  resetPassword,
  deactivateUser,
  reactivateUser,
  ClientNotFoundError,
} from "./service.js";

export const usersRoutes = new Hono<HonoEnv>();

// POST /users — Create a new user (admin only)
usersRoutes.post(
  "/",
  authMiddleware,
  tenantMiddleware,
  requireRole("admin"),
  zValidator("json", createUserSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const body = c.req.valid("json");

    try {
      const result = await createUser(db, tenantId, user.id, body);

      if (!result) {
        return c.json(
          { error: "El correo electrónico ya está registrado en esta organización" },
          409,
        );
      }

      return c.json({ data: result }, 201);
    } catch (err) {
      // 010 — clientId inválido / inactivo / cross-tenant. Mensaje uniforme
      // para no filtrar enumeration; HTTP 400 (FR-004).
      if (err instanceof ClientNotFoundError) {
        return c.json({ error: "cliente inactivo o inexistente" }, 400);
      }
      throw err;
    }
  },
);

// POST /users/import — Bulk import users from CSV (admin only)
usersRoutes.post(
  "/import",
  authMiddleware,
  tenantMiddleware,
  requireRole("admin"),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");

    const contentType = c.req.header("content-type") ?? "";
    let csvText: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return c.json({ error: "El archivo CSV es requerido" }, 400);
      }
      csvText = await file.text();
    } else {
      csvText = await c.req.text();
    }

    const result = await bulkImportUsers(db, tenantId, user.id, csvText);

    if ("error" in result) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ data: result });
  },
);

// GET /users — List users (all authenticated roles, service-level scoping)
usersRoutes.get(
  "/",
  authMiddleware,
  tenantMiddleware,
  zValidator("query", listUsersQuerySchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const query = c.req.valid("query");

    const result = await listUsers(db, tenantId, {
      ...query,
      currentUser: { id: user.id, role: user.role },
    });

    return c.json(result);
  },
);

// GET /users/:id — Get user detail
usersRoutes.get(
  "/:id",
  authMiddleware,
  tenantMiddleware,
  async (c) => {
    const user = c.get("user");
    const db = c.get("db");
    const userId = c.req.param("id");

    const result = await getUserById(db, userId, {
      id: user.id,
      role: user.role,
    });

    if (!result) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ data: result });
  },
);

// PATCH /users/:id — Update user
usersRoutes.patch(
  "/:id",
  authMiddleware,
  tenantMiddleware,
  zValidator("json", updateUserSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const targetId = c.req.param("id");
    const body = c.req.valid("json");

    const result = await updateUser(db, tenantId, user.id, targetId, user.role, body);

    if (!result) {
      return c.json({ error: "User not found" }, 404);
    }

    if ("error" in result) {
      return c.json({ error: result.error }, 403);
    }

    return c.json({ data: result });
  },
);

// POST /users/:id/change-password — Self-service password change
usersRoutes.post(
  "/:id/change-password",
  authMiddleware,
  tenantMiddleware,
  zValidator("json", changePasswordSchema),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const targetId = c.req.param("id");
    const body = c.req.valid("json");

    if (user.id !== targetId) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const result = await changePassword(db, tenantId, user.id, targetId, body);

    if ("error" in result) {
      return c.json({ error: result.error }, 400);
    }

    // Issue fresh JWT with updated mustChangePassword claim
    const { accessToken, expiresAt } = await generateAccessToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        isFreelancer: user.isFreelancer,
        mustChangePassword: false,
      },
      c.env.JWT_ACCESS_SECRET,
    );

    return c.json({
      success: true,
      accessToken,
      expiresAt,
      user: result.user,
    });
  },
);

// POST /users/:id/reset-password — Admin password reset
usersRoutes.post(
  "/:id/reset-password",
  authMiddleware,
  tenantMiddleware,
  requireRole("admin"),
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const user = c.get("user");
    const db = c.get("db");
    const targetId = c.req.param("id");
    const body = c.req.valid("json");

    const result = await resetPassword(db, tenantId, user.id, targetId, body);

    if (!result) {
      return c.json({ error: "User not found" }, 404);
    }

    if ("error" in result) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result);
  },
);

// PATCH /users/:id/deactivate — Deactivate user (admin only)
usersRoutes.patch(
  "/:id/deactivate",
  authMiddleware,
  tenantMiddleware,
  requireRole("admin"),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const targetId = c.req.param("id");

    const result = await deactivateUser(db, tenantId, user.id, targetId);

    if (!result) {
      return c.json({ error: "User not found" }, 404);
    }

    if ("error" in result) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ data: result });
  },
);

// PATCH /users/:id/reactivate — Reactivate user (admin only)
usersRoutes.patch(
  "/:id/reactivate",
  authMiddleware,
  tenantMiddleware,
  requireRole("admin"),
  async (c) => {
    const user = c.get("user");
    const tenantId = c.get("tenantId");
    const db = c.get("db");
    const targetId = c.req.param("id");

    const result = await reactivateUser(db, tenantId, user.id, targetId);

    if (!result) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({ data: result });
  },
);
