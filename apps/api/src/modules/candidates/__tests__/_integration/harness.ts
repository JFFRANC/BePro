// Harness compartido para tests de integración contra Neon real.
//
// Principio de diseño: dos conexiones, dos roles.
//   - `adminDb`   → DATABASE_URL (neondb_owner, BYPASSRLS). Se usa SOLO para
//                   seedear fixtures y limpiar después. Nunca para ejercer el
//                   endpoint bajo prueba.
//   - `workerDb`  → DATABASE_URL_WORKER (app_worker, NOBYPASSRLS). Es el rol
//                   con el que corre el Worker en producción; con este cliente
//                   las políticas RLS SÍ aplican y los tests prueban el límite
//                   real. Cada test abre su propia transacción con
//                   `SET LOCAL app.tenant_id = ...`.
//
// Aislamiento entre tests: cada invocación de `seedTenant()` crea un tenant
// con slug único (UUID). No hay estado compartido. `cleanupTenant()` borra
// todo al final de cada test (o `afterAll`) vía el cliente admin.

import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import {
  createDb,
  tenants,
  users,
  clients,
  clientAssignments,
  candidates,
  candidateAttachments,
  candidateDuplicateLinks,
  rejectionCategories,
  declineCategories,
  privacyNotices,
  retentionReviews,
  auditEvents,
  type Database,
} from "@bepro/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { sign } from "hono/jwt";

// En Node (vs Cloudflare Workers) el driver neon-serverless necesita un
// WebSocket polyfill para abrir transacciones con SET LOCAL. Sin esto la
// conexión se cierra con "Connection terminated unexpectedly".
// Ver https://github.com/neondatabase/serverless#configuration
neonConfig.webSocketConstructor = ws;

// ========================================
// Clientes cacheados (evitan recrear pools por test)
// ========================================

let _adminDb: Database | undefined;
let _workerDb: Database | undefined;

export function getAdminDb(): Database {
  if (!_adminDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL requerido para tests de integración (rol admin con BYPASSRLS).",
      );
    }
    _adminDb = createDb(url);
  }
  return _adminDb;
}

export function getWorkerDb(): Database {
  if (!_workerDb) {
    const url = process.env.DATABASE_URL_WORKER;
    if (!url) {
      throw new Error(
        "DATABASE_URL_WORKER requerido. Ejecuta `pnpm -F @bepro/db db:create-app-worker` y copia la URL impresa a apps/api/.dev.vars.",
      );
    }
    _workerDb = createDb(url);
  }
  return _workerDb;
}

// ========================================
// Seed / cleanup de tenants para tests
// ========================================

export type SeededUser = {
  id: string;
  email: string;
  role: "admin" | "manager" | "account_executive" | "recruiter";
};

export type SeededTenant = {
  tenantId: string;
  slug: string;
  users: {
    admin: SeededUser;
    manager: SeededUser;
    ae: SeededUser;
    recruiter: SeededUser;
  };
  clientId: string;
  // Categorías y aviso de privacidad sembrados por defecto en el tenant
  // (emulamos lo que haría la migración 0007 al provisionar un tenant nuevo).
  privacyNoticeId: string;
  rejectionCategoryId: string;
  declineCategoryId: string;
};

// Contraseña compartida para todos los usuarios seedeados. El bcrypt es lento;
// generamos el hash una sola vez y lo reutilizamos.
let _cachedHash: string | undefined;
async function getSeedPasswordHash(): Promise<string> {
  if (!_cachedHash) {
    _cachedHash = await bcrypt.hash("integration-test-password", 4);
  }
  return _cachedHash;
}

async function insertDefaultCategories(tenantId: string): Promise<{
  rejectionCategoryId: string;
  declineCategoryId: string;
  privacyNoticeId: string;
}> {
  const db = getAdminDb();

  const [rej] = await db
    .insert(rejectionCategories)
    .values({ tenantId, label: "No calificado" })
    .returning({ id: rejectionCategories.id });

  const [dec] = await db
    .insert(declineCategories)
    .values({ tenantId, label: "Contraoferta aceptada" })
    .returning({ id: declineCategories.id });

  const [pn] = await db
    .insert(privacyNotices)
    .values({
      tenantId,
      version: `test-${Date.now()}`,
      textMd: "Aviso de privacidad de prueba.",
      effectiveFrom: new Date(),
      isActive: true,
    })
    .returning({ id: privacyNotices.id });

  return {
    rejectionCategoryId: rej.id,
    declineCategoryId: dec.id,
    privacyNoticeId: pn.id,
  };
}

export async function seedTenant(): Promise<SeededTenant> {
  const db = getAdminDb();
  const hash = await getSeedPasswordHash();
  const slug = `test-${randomUUID().slice(0, 8)}`;

  const [tenant] = await db
    .insert(tenants)
    .values({ name: `Test Tenant ${slug}`, slug })
    .returning({ id: tenants.id });

  const userRows = await db
    .insert(users)
    .values([
      {
        tenantId: tenant.id,
        email: `admin+${slug}@test.bepro.mx`,
        passwordHash: hash,
        firstName: "Admin",
        lastName: "Test",
        role: "admin",
      },
      {
        tenantId: tenant.id,
        email: `manager+${slug}@test.bepro.mx`,
        passwordHash: hash,
        firstName: "Manager",
        lastName: "Test",
        role: "manager",
      },
      {
        tenantId: tenant.id,
        email: `ae+${slug}@test.bepro.mx`,
        passwordHash: hash,
        firstName: "AE",
        lastName: "Test",
        role: "account_executive",
      },
      {
        tenantId: tenant.id,
        email: `rec+${slug}@test.bepro.mx`,
        passwordHash: hash,
        firstName: "Recruiter",
        lastName: "Test",
        role: "recruiter",
      },
    ])
    .returning({ id: users.id, email: users.email, role: users.role });

  const admin = userRows.find((u) => u.role === "admin")!;
  const manager = userRows.find((u) => u.role === "manager")!;
  const ae = userRows.find((u) => u.role === "account_executive")!;
  const recruiter = userRows.find((u) => u.role === "recruiter")!;

  const [client] = await db
    .insert(clients)
    .values({
      tenantId: tenant.id,
      name: `Test Client ${slug}`,
      email: `client+${slug}@test.bepro.mx`,
      formConfig: {},
    })
    .returning({ id: clients.id });

  // El AE queda asignado al cliente para ejercer FR-033.
  await db
    .insert(clientAssignments)
    .values({ tenantId: tenant.id, clientId: client.id, userId: ae.id });

  const { rejectionCategoryId, declineCategoryId, privacyNoticeId } =
    await insertDefaultCategories(tenant.id);

  return {
    tenantId: tenant.id,
    slug,
    users: {
      admin: { id: admin.id, email: admin.email, role: "admin" },
      manager: { id: manager.id, email: manager.email, role: "manager" },
      ae: { id: ae.id, email: ae.email, role: "account_executive" },
      recruiter: {
        id: recruiter.id,
        email: recruiter.email,
        role: "recruiter",
      },
    },
    clientId: client.id,
    privacyNoticeId,
    rejectionCategoryId,
    declineCategoryId,
  };
}

// Borra todo lo seedeado para un tenant. Idempotente: segura de llamar aunque
// alguna tabla esté vacía. Usa el cliente admin porque RLS bloquearía varias
// de estas operaciones al correr como app_worker.
//
// Nota: las tablas append-only (`audit_events`, `retention_reviews`,
// `candidate_duplicate_links`) tienen policy `USING(false)` sobre DELETE que
// aplica incluso al owner (FORCE ROW LEVEL SECURITY). Eso bloquea el borrado
// aunque corramos como neondb_owner, y por FK encadena al DELETE del tenant
// (audit_events referencia tenants). La limpieza se hace *best effort*:
// tragamos el error de cada DELETE y seguimos. Tenants huérfanos con slug
// `test-<uuid>` no molestan porque no son activos ni colisionan. Una purga
// manual periódica puede limpiarlos si alguien quiere.
export async function cleanupTenant(tenantId: string): Promise<void> {
  const db = getAdminDb();
  const tables = [
    { name: "audit_events", stmt: db.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId)) },
    { name: "candidate_duplicate_links", stmt: db.delete(candidateDuplicateLinks).where(eq(candidateDuplicateLinks.tenantId, tenantId)) },
    { name: "candidate_attachments", stmt: db.delete(candidateAttachments).where(eq(candidateAttachments.tenantId, tenantId)) },
    { name: "candidates", stmt: db.delete(candidates).where(eq(candidates.tenantId, tenantId)) },
    { name: "retention_reviews", stmt: db.delete(retentionReviews).where(eq(retentionReviews.tenantId, tenantId)) },
    { name: "privacy_notices", stmt: db.delete(privacyNotices).where(eq(privacyNotices.tenantId, tenantId)) },
    { name: "rejection_categories", stmt: db.delete(rejectionCategories).where(eq(rejectionCategories.tenantId, tenantId)) },
    { name: "decline_categories", stmt: db.delete(declineCategories).where(eq(declineCategories.tenantId, tenantId)) },
    { name: "client_assignments", stmt: db.delete(clientAssignments).where(eq(clientAssignments.tenantId, tenantId)) },
    { name: "clients", stmt: db.delete(clients).where(eq(clients.tenantId, tenantId)) },
    { name: "users", stmt: db.delete(users).where(eq(users.tenantId, tenantId)) },
    { name: "tenants", stmt: db.delete(tenants).where(eq(tenants.id, tenantId)) },
  ];
  for (const { stmt } of tables) {
    try {
      await stmt;
    } catch {
      // best-effort; ver nota del header
    }
  }
}

// ========================================
// SET LOCAL helper
// ========================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Opens a transaction on the given db client and sets app.tenant_id for the
// duration. Matches the Worker middleware pattern (apps/api/src/modules/auth/middleware.ts:64)
// so tests exercise the exact same RLS path as production.
export async function withTenantScope<T>(
  db: Database,
  tenantId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`withTenantScope: tenantId malformado: ${tenantId}`);
  }
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.tenant_id = '${sql.raw(tenantId)}'`);
    return await fn(tx as unknown as Database);
  });
}

// ========================================
// JWT + Hono env helpers para tests que pegan al HTTP
// ========================================

export const INTEGRATION_JWT_SECRET = "integration-jwt-secret-256-bits!!!!!!";

// Forja un access token con la MISMA forma que el middleware `authMiddleware`
// lee en apps/api/src/modules/auth/middleware.ts:19-30 (camelCase). Si los
// nombres de campo divergen, el middleware rompe silenciosamente porque
// `payload.tenantId` queda undefined y el lookup de tenants falla con 401.
export async function signAccessToken(input: {
  userId: string;
  tenantId: string;
  role: "admin" | "manager" | "account_executive" | "recruiter";
  isFreelancer?: boolean;
  email?: string;
  mustChangePassword?: boolean;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: input.userId,
      email: input.email ?? `test-${input.userId}@bepro.test`,
      role: input.role,
      tenantId: input.tenantId,
      isFreelancer: input.isFreelancer ?? false,
      mustChangePassword: input.mustChangePassword ?? false,
      iat: now,
      exp: now + 15 * 60,
    },
    INTEGRATION_JWT_SECRET,
  );
}

// Env de bindings para `app.request(path, init, env)`. Usa DATABASE_URL_WORKER
// para que el Worker bajo prueba corra con app_worker — así los endpoints
// ejercen RLS de verdad.
export function integrationEnv(): {
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  ENVIRONMENT: string;
  FILES: R2Bucket;
} {
  const url = process.env.DATABASE_URL_WORKER;
  if (!url) {
    throw new Error(
      "DATABASE_URL_WORKER requerido (rol app_worker). Corre `pnpm -F @bepro/db db:create-app-worker` primero.",
    );
  }
  // R2 no se ejercita en estos tests; un stub mínimo basta. Si un test quiere
  // probar attachments, puede inyectar su propio R2 mock.
  const r2Stub = {
    put: async () => undefined as unknown,
    get: async () => null,
    delete: async () => undefined as unknown,
    head: async () => null,
    list: async () => ({ objects: [] }),
  } as unknown as R2Bucket;

  return {
    DATABASE_URL: url,
    JWT_ACCESS_SECRET: INTEGRATION_JWT_SECRET,
    ENVIRONMENT: "integration",
    FILES: r2Stub,
  };
}
