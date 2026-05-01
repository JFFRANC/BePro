-- 011-puestos-profile-docs / US5 — archivo de `client_documents` legacy.
--
-- 1. Agrega `is_active` (default true).
-- 2. Marca toda fila previa como inactiva (no UI lo muestra ya).
-- 3. Emite un evento `client_document.archive` por tenant para auditoría.
--
-- IDEMPOTENT: rerun-safe.
--   - ADD COLUMN IF NOT EXISTS no falla en re-ejecución.
--   - El UPDATE sólo toca filas todavía activas; tras el primer run no afecta nada.
--   - El INSERT en audit_events se condiciona a la existencia de filas previas.
--     En re-ejecución, el UPDATE no afecta filas → entramos al loop y emitimos
--     audit con rowsAffected=0; pre-condición: el loop SÓLO emite si el tenant
--     tenía rows tocadas en esta ejecución (NEW.rowsAffected > 0).
--
-- Run as `neondb_owner` (BYPASSRLS) — operación global.

ALTER TABLE client_documents
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
--> statement-breakpoint

-- Snapshot pre-update por tenant para emitir audit con rowsAffected reales.
DO $$
DECLARE
  r record;
  rows_affected_tenant int;
BEGIN
  FOR r IN
    SELECT tenant_id, COUNT(*) AS n
    FROM client_documents
    WHERE is_active = true
    GROUP BY tenant_id
  LOOP
    -- Flip todas las filas activas de este tenant en una sola sentencia.
    UPDATE client_documents
       SET is_active = false
     WHERE tenant_id = r.tenant_id AND is_active = true;
    GET DIAGNOSTICS rows_affected_tenant = ROW_COUNT;

    IF rows_affected_tenant > 0 THEN
      INSERT INTO audit_events (
        tenant_id,
        actor_id,
        action,
        target_type,
        target_id,
        old_values,
        new_values
      )
      VALUES (
        r.tenant_id,
        '00000000-0000-0000-0000-000000000000'::uuid, -- system actor sentinel
        'archive',
        'client_document',
        '00000000-0000-0000-0000-000000000000'::uuid, -- target_id sentinel (NOT NULL en schema)
        NULL,
        jsonb_build_object(
          'rowsAffected', rows_affected_tenant,
          'migrationId', '0010_legacy_client_documents_archive',
          'reason', 'feature-011-rollout',
          'executedAt', now()
        )
      );
    END IF;
  END LOOP;
END
$$;
