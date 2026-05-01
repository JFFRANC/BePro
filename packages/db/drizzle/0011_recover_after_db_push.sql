-- Recovery script — restaura columnas/índices que `pnpm db:push` borró porque
-- no viven en el schema TypeScript de Drizzle. Idempotente.
--
-- Origen del problema: `0006_candidates_search_trigger.sql` agregó la columna
-- `candidates.search_tsv` y el índice GIN por SQL crudo. La schema TS de Drizzle
-- no la declara, así que el siguiente `db:push` la marca como "extra" y la dropea.
-- El trigger `candidates_search_tsv_trg` queda apuntando a una columna fantasma
-- y todo INSERT/UPDATE en candidates explota con `record "new" has no field "search_tsv"`.

-- 1. Restaurar columna + índice GIN.
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS search_tsv tsvector;
--> statement-breakpoint

DROP INDEX IF EXISTS candidates_search_idx;
--> statement-breakpoint

CREATE INDEX candidates_search_idx ON candidates USING GIN (search_tsv);
--> statement-breakpoint

-- 2. Backfill — UPDATE no-op dispara el trigger y rellena search_tsv.
UPDATE candidates SET first_name = first_name;
--> statement-breakpoint

-- 3. Verificar/restaurar RLS por defensa en profundidad. Si push no las tocó,
-- `IF NOT EXISTS` lo hace seguro.
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assignments FORCE ROW LEVEL SECURITY;
