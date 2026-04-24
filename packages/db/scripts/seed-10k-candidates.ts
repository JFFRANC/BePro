// T130 / SC-002 — Seed determinista y idempotente de 10 000 candidatos
// contra el tenant de performance `perf-10k`. El test de perf
// (`apps/api/src/modules/candidates/__tests__/perf.integration.test.ts`)
// lee esta data y verifica que las queries calientes (list + filter + search)
// NO caen a seq-scan y se mantienen dentro de presupuesto.
//
// Ejecución: `pnpm -F @bepro/db seed:candidates-10k`
//
// Principios:
//   - Usa DATABASE_URL (neondb_owner, BYPASSRLS) como el resto de scripts.
//   - Idempotente: si el tenant ya tiene ≥ 10 000 candidatos, sale con 0.
//   - Determinista: el generador `mulberry32` se siembra desde el índice,
//     así cada corrida produce el mismo dataset (útil para reproducibilidad
//     entre corridas del test de perf).
//   - Batched inserts (500 filas/batch) para no reventar el cap del payload HTTP de Neon.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { eq, and, sql as dsql } from "drizzle-orm";
import {
  tenants,
  users,
  clients,
  privacyNotices,
  rejectionCategories,
  declineCategories,
  candidates,
  type CandidateInsert,
} from "../src/schema/index.js";

// ============================================================================
// Constantes del dataset
// ============================================================================

const PERF_SLUG = "perf-10k";
const PERF_TENANT_NAME = "BePro Perf Test";
const PERF_CLIENT_NAME = "Perf Client";
const PERF_PRIVACY_VERSION = "perf-2026-04";
const TARGET_COUNT = 10_000;
const BATCH_SIZE = 500;
// Un candidato intencionalmente único para el test SC-008 (búsqueda FTS).
const SENTINEL_LAST_NAME = "ZZZ-UNIQUE-SENTINEL-42";

// Distribución por status (suma = 1.0). Refleja un pipeline realista donde
// la mayoría está en etapas tempranas; así el índice parcial
// `candidates_tenant_client_status_idx` efectivamente filtra.
const STATUS_DISTRIBUTION: Array<{
  status: CandidateInsert["status"];
  weight: number;
}> = [
  { status: "registered", weight: 0.6 },
  { status: "interview_scheduled", weight: 0.15 },
  { status: "attended", weight: 0.1 },
  { status: "approved", weight: 0.1 },
  { status: "hired", weight: 0.05 },
];

const INACTIVE_RATIO = 0.05; // 5% soft-deleted (exercita default filter)

// ============================================================================
// RNG determinista (mulberry32)
// ============================================================================

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickStatus(rng: () => number): CandidateInsert["status"] {
  const r = rng();
  let acc = 0;
  for (const { status, weight } of STATUS_DISTRIBUTION) {
    acc += weight;
    if (r < acc) return status;
  }
  return STATUS_DISTRIBUTION[STATUS_DISTRIBUTION.length - 1].status;
}

// ============================================================================
// Generadores de datos sintéticos
// ============================================================================

const FIRST_NAMES = [
  "Juan", "María", "Luis", "Ana", "Carlos", "Sofía", "Jorge", "Laura",
  "Pedro", "Valeria", "Diego", "Camila", "Andrés", "Paula", "Ricardo",
  "Gabriela", "Fernando", "Daniela", "Héctor", "Mariana",
];

const LAST_NAMES = [
  "García", "Martínez", "López", "Hernández", "González", "Rodríguez",
  "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez",
  "Díaz", "Cruz", "Morales", "Ortiz", "Gutiérrez", "Chávez", "Ruiz",
];

const POSITIONS = [
  "Software Engineer", "Product Manager", "Data Analyst", "Designer",
  "QA Engineer", "DevOps", "Technical Lead", "Recruiter", "Accountant",
  "Sales Executive",
];

const SOURCES = ["referral", "linkedin", "job-board", "direct", "agency"];

function buildCandidateRow(
  idx: number,
  tenantId: string,
  clientId: string,
  recruiterUserId: string,
  privacyNoticeId: string,
): CandidateInsert {
  const rng = mulberry32(idx + 1); // evitar semilla 0
  const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  // El índice 0 recibe el sentinel para el test de FTS.
  const lastName =
    idx === 0 ? SENTINEL_LAST_NAME : LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
  const source = SOURCES[Math.floor(rng() * SOURCES.length)];

  // Teléfono único por fila (10 dígitos). Se combina con clientId para respetar
  // el índice parcial (tenant_id, phone_normalized, client_id).
  const phoneNormalized = (5_500_000_000 + idx).toString().slice(0, 10);
  const phone = `+52 ${phoneNormalized.slice(0, 3)} ${phoneNormalized.slice(3, 6)} ${phoneNormalized.slice(6)}`;

  // Email único — índice suficientemente grande para no colisionar.
  const email = `perf-${idx.toString(36)}@perf.bepro.test`;

  const status = pickStatus(rng);
  const isActive = rng() >= INACTIVE_RATIO;

  // created_at / updated_at distribuidos en los últimos 90 días.
  const daysAgo = rng() * 90;
  const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  // updated_at puede ser ligeramente posterior a created_at.
  const updatedAt = new Date(
    createdAt.getTime() + rng() * (Date.now() - createdAt.getTime()),
  );

  return {
    tenantId,
    clientId,
    registeringUserId: recruiterUserId,
    firstName,
    lastName,
    phone,
    phoneNormalized,
    email,
    currentPosition: position,
    source,
    status,
    additionalFields: {},
    privacyNoticeId,
    privacyNoticeAcknowledgedAt: createdAt,
    isActive,
    createdAt,
    updatedAt,
  };
}

// ============================================================================
// Provisionamiento (tenant, usuario admin, cliente, aviso, categorías)
// ============================================================================

type ProvisionResult = {
  tenantId: string;
  clientId: string;
  adminUserId: string;
  privacyNoticeId: string;
};

async function provisionPerfTenant(
  db: ReturnType<typeof drizzle>,
): Promise<ProvisionResult> {
  // 1) Tenant — reuse si ya existe.
  const existingTenant = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, PERF_SLUG))
    .limit(1);

  let tenantId: string;
  if (existingTenant.length > 0) {
    tenantId = existingTenant[0].id;
    console.log(`[seed] Tenant '${PERF_SLUG}' already exists, reusing.`);
  } else {
    const [created] = await db
      .insert(tenants)
      .values({ name: PERF_TENANT_NAME, slug: PERF_SLUG })
      .returning({ id: tenants.id });
    tenantId = created.id;
    console.log(`[seed] Created tenant '${PERF_SLUG}' (${tenantId}).`);
  }

  // 2) Admin user.
  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.email, "perf-admin@perf.bepro.test")))
    .limit(1);

  let adminUserId: string;
  if (existingAdmin.length > 0) {
    adminUserId = existingAdmin[0].id;
  } else {
    const passwordHash = await hash("perf-admin-password", 4);
    const [admin] = await db
      .insert(users)
      .values({
        tenantId,
        email: "perf-admin@perf.bepro.test",
        passwordHash,
        firstName: "Perf",
        lastName: "Admin",
        role: "admin",
      })
      .returning({ id: users.id });
    adminUserId = admin.id;
    console.log(`[seed] Created admin user for perf tenant.`);
  }

  // 3) Cliente.
  const existingClient = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), eq(clients.name, PERF_CLIENT_NAME)))
    .limit(1);

  let clientId: string;
  if (existingClient.length > 0) {
    clientId = existingClient[0].id;
  } else {
    const [client] = await db
      .insert(clients)
      .values({
        tenantId,
        name: PERF_CLIENT_NAME,
        email: "perf-client@perf.bepro.test",
        formConfig: {},
      })
      .returning({ id: clients.id });
    clientId = client.id;
    console.log(`[seed] Created client '${PERF_CLIENT_NAME}'.`);
  }

  // 4) Aviso de privacidad (versión perf-2026-04, active).
  const existingNotice = await db
    .select({ id: privacyNotices.id })
    .from(privacyNotices)
    .where(
      and(
        eq(privacyNotices.tenantId, tenantId),
        eq(privacyNotices.version, PERF_PRIVACY_VERSION),
      ),
    )
    .limit(1);

  let privacyNoticeId: string;
  if (existingNotice.length > 0) {
    privacyNoticeId = existingNotice[0].id;
  } else {
    // El índice `privacy_notices_tenant_active_uniq` impide más de un activo por
    // tenant; desactivamos cualquier otro activo antes de insertar.
    await db
      .update(privacyNotices)
      .set({ isActive: false })
      .where(eq(privacyNotices.tenantId, tenantId));

    const [notice] = await db
      .insert(privacyNotices)
      .values({
        tenantId,
        version: PERF_PRIVACY_VERSION,
        textMd: "# Perf tenant privacy notice\n\nSynthetic data only.",
        effectiveFrom: new Date(),
        isActive: true,
      })
      .returning({ id: privacyNotices.id });
    privacyNoticeId = notice.id;
    console.log(`[seed] Created privacy notice '${PERF_PRIVACY_VERSION}'.`);
  }

  // 5) Categorías por defecto (rejection + decline).
  const existingRej = await db
    .select({ id: rejectionCategories.id })
    .from(rejectionCategories)
    .where(eq(rejectionCategories.tenantId, tenantId))
    .limit(1);
  if (existingRej.length === 0) {
    await db
      .insert(rejectionCategories)
      .values({ tenantId, label: "Perf rejection" });
  }

  const existingDec = await db
    .select({ id: declineCategories.id })
    .from(declineCategories)
    .where(eq(declineCategories.tenantId, tenantId))
    .limit(1);
  if (existingDec.length === 0) {
    await db
      .insert(declineCategories)
      .values({ tenantId, label: "Perf decline" });
  }

  return { tenantId, clientId, adminUserId, privacyNoticeId };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (neondb_owner with BYPASSRLS).");
    process.exit(1);
  }

  const neonSql = neon(databaseUrl);
  const db = drizzle(neonSql);

  console.log("[seed] Provisioning perf tenant...");
  const { tenantId, clientId, adminUserId, privacyNoticeId } =
    await provisionPerfTenant(db);

  // Check idempotencia: si ya hay ≥ TARGET_COUNT filas, no hacer nada.
  const [{ count: existingCount }] = (await db.execute(
    dsql`SELECT count(*)::int AS count FROM candidates WHERE tenant_id = ${tenantId}`,
  )) as unknown as Array<{ count: number }>;

  if (existingCount >= TARGET_COUNT) {
    console.log(
      `[seed] Seed already applied, skipping. (${existingCount} candidates present for tenant ${tenantId})`,
    );
    process.exit(0);
  }

  const toInsert = TARGET_COUNT - existingCount;
  console.log(
    `[seed] ${existingCount} existing, inserting ${toInsert} more candidates (target=${TARGET_COUNT}).`,
  );

  // Insertamos a partir de `existingCount` para mantener determinismo
  // cuando una corrida previa quedó a medias.
  let inserted = 0;
  for (let start = existingCount; start < TARGET_COUNT; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE, TARGET_COUNT);
    const batch: CandidateInsert[] = [];
    for (let i = start; i < end; i++) {
      batch.push(
        buildCandidateRow(i, tenantId, clientId, adminUserId, privacyNoticeId),
      );
    }

    try {
      await db.insert(candidates).values(batch);
    } catch (err) {
      console.error(
        `[seed] Batch insert failed at index ${start}..${end - 1}:`,
        (err as Error).message,
      );
      process.exit(1);
    }

    inserted += batch.length;
    // Progreso cada 1 000 filas.
    if (inserted % 1000 === 0 || end === TARGET_COUNT) {
      console.log(`[seed] inserted ${existingCount + inserted} / ${TARGET_COUNT} candidates`);
    }
  }

  console.log(`[seed] Done. Tenant=${tenantId} Client=${clientId} Admin=${adminUserId}.`);
  console.log(
    `[seed] Sentinel last_name='${SENTINEL_LAST_NAME}' present in candidate index 0 (for SC-008 FTS test).`,
  );
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
