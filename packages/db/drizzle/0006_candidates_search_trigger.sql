-- 007-candidates-module — paso 4: full-text search sobre candidates (FR-021 / data-model §10)

-- Columna tsvector mantenida por trigger
ALTER TABLE candidates
  ADD COLUMN search_tsv tsvector;

CREATE OR REPLACE FUNCTION candidates_search_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    to_tsvector('simple',
      coalesce(NEW.first_name, '') || ' ' ||
      coalesce(NEW.last_name, '') || ' ' ||
      coalesce(NEW.email, '') || ' ' ||
      coalesce(NEW.phone, '') || ' ' ||
      coalesce(NEW.phone_normalized, '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_search_tsv_trg
  BEFORE INSERT OR UPDATE OF first_name, last_name, email, phone, phone_normalized
  ON candidates
  FOR EACH ROW
  EXECUTE FUNCTION candidates_search_tsv_update();

CREATE INDEX candidates_search_idx ON candidates USING GIN (search_tsv);

-- Backfill (no-op en producción si la tabla está vacía al deploy inicial)
UPDATE candidates SET first_name = first_name;
