-- 007-candidates-module — paso 6: grants mínimos para el rol app_worker (Fase 10A)
--
-- Este archivo asume que el rol `app_worker` YA FUE CREADO con
-- `NOBYPASSRLS LOGIN PASSWORD '...'` mediante `pnpm -F @bepro/db db:create-app-worker`.
-- El rol es quien usará el Worker en producción y los tests de integración para
-- demostrar que RLS realmente protege contra cross-tenant leakage (Principio I).
--
-- Idempotente: se puede re-ejecutar sin problema; los GRANTs son aditivos.

-- Acceso al esquema público.
GRANT USAGE ON SCHEMA public TO app_worker;

-- Lookups del flujo de login (tenants no tiene RLS, users/refresh_tokens sí se
-- consultan dentro de la transacción con SET LOCAL cuando el middleware actúa).
GRANT SELECT ON tenants TO app_worker;
GRANT SELECT, INSERT, UPDATE ON users TO app_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO app_worker;

-- Clientes y sus relaciones.
GRANT SELECT, INSERT, UPDATE ON clients TO app_worker;
GRANT SELECT, INSERT, UPDATE ON client_assignments TO app_worker;
GRANT SELECT, INSERT, UPDATE ON client_contacts TO app_worker;
GRANT SELECT, INSERT, UPDATE ON client_positions TO app_worker;
GRANT SELECT, INSERT, UPDATE ON client_documents TO app_worker;

-- Candidatos y sus tablas accesorias (007).
GRANT SELECT, INSERT, UPDATE ON candidates TO app_worker;
GRANT SELECT, INSERT, UPDATE ON candidate_attachments TO app_worker;
GRANT SELECT, INSERT ON candidate_duplicate_links TO app_worker; -- append-only
GRANT SELECT, INSERT, UPDATE ON rejection_categories TO app_worker;
GRANT SELECT, INSERT, UPDATE ON decline_categories TO app_worker;
GRANT SELECT, INSERT, UPDATE ON privacy_notices TO app_worker;
GRANT SELECT, INSERT ON retention_reviews TO app_worker; -- append-only (FR-003a)

-- audit_events es APPEND-ONLY a nivel de privilegio (FR-062): SELECT + INSERT
-- únicamente. No se concede UPDATE ni DELETE, así que cualquier intento del
-- Worker de modificar/borrar eventos fallará con "permission denied" incluso
-- antes de llegar a las políticas RLS.
GRANT SELECT, INSERT ON audit_events TO app_worker;

-- Permisos sobre secuencias (no son estrictamente necesarios porque usamos
-- gen_random_uuid() como default, pero se incluyen por higiene para futuras
-- columnas serial/bigserial).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_worker;

-- Default privileges: cualquier tabla futura creada por neondb_owner hereda
-- SELECT/INSERT/UPDATE para app_worker. Esto evita tener que extender este
-- archivo por cada migración nueva. DELETE permanece sin conceder por diseño
-- (constitución: soft-delete only, LFPDPPP).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO app_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_worker;
