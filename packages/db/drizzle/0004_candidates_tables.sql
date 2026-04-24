-- 007-candidates-module — paso 2: tablas del módulo de candidatos (data-model §1-§8)

-- ========================================
-- privacy_notices — versiones del aviso LFPDPPP por tenant (R11)
-- ========================================

CREATE TABLE privacy_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  version varchar(20) NOT NULL,
  text_md text NOT NULL,
  effective_from timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX privacy_notices_tenant_version_uniq
  ON privacy_notices (tenant_id, version);

CREATE UNIQUE INDEX privacy_notices_tenant_active_uniq
  ON privacy_notices (tenant_id) WHERE is_active = true;

-- ========================================
-- rejection_categories — catálogo por tenant (R8 / FR-050)
-- ========================================

CREATE TABLE rejection_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  label varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX rejection_categories_tenant_label_uniq
  ON rejection_categories (tenant_id, label) WHERE is_active = true;

-- ========================================
-- decline_categories — catálogo por tenant (R8 / FR-050)
-- ========================================

CREATE TABLE decline_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  label varchar(100) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX decline_categories_tenant_label_uniq
  ON decline_categories (tenant_id, label) WHERE is_active = true;

-- ========================================
-- candidates — registro principal (data-model §1)
-- ========================================

CREATE TABLE candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid NOT NULL REFERENCES clients(id),
  registering_user_id uuid NOT NULL REFERENCES users(id),
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  phone varchar(40) NOT NULL,
  phone_normalized varchar(20) NOT NULL,
  email varchar(255) NOT NULL,
  current_position varchar(200),
  source varchar(100) NOT NULL,
  status candidate_status NOT NULL DEFAULT 'registered',
  additional_fields jsonb NOT NULL DEFAULT '{}',
  rejection_category_id uuid REFERENCES rejection_categories(id),
  decline_category_id uuid REFERENCES decline_categories(id),
  privacy_notice_id uuid NOT NULL REFERENCES privacy_notices(id),
  privacy_notice_acknowledged_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Asegura que phone_normalized sólo contiene dígitos (R2)
  CONSTRAINT candidates_phone_normalized_digits CHECK (phone_normalized ~ '^[0-9]+$'),
  -- Coherencia categoría/estado (FR-035): rejected requiere categoría
  CONSTRAINT candidates_rejected_requires_category CHECK (
    status <> 'rejected' OR rejection_category_id IS NOT NULL
  ),
  -- Coherencia categoría/estado (FR-035): declined requiere categoría
  CONSTRAINT candidates_declined_requires_category CHECK (
    status <> 'declined' OR decline_category_id IS NOT NULL
  )
);

CREATE INDEX candidates_tenant_client_status_idx
  ON candidates (tenant_id, client_id, status) WHERE is_active = true;

CREATE INDEX candidates_tenant_recruiter_idx
  ON candidates (tenant_id, registering_user_id) WHERE is_active = true;

-- Índice para detección de duplicados (R2 / FR-014). NO ES UNIQUE: FR-015 permite confirmar duplicados.
CREATE INDEX candidates_dup_idx
  ON candidates (tenant_id, phone_normalized, client_id) WHERE is_active = true;

CREATE INDEX candidates_updated_idx
  ON candidates (tenant_id, updated_at DESC);

-- ========================================
-- candidate_attachments — archivos adjuntos (data-model §2 / FR-040..044)
-- ========================================

CREATE TABLE candidate_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  uploader_user_id uuid NOT NULL REFERENCES users(id),
  file_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL,
  size_bytes integer NOT NULL,
  storage_key varchar(500) NOT NULL,
  tag varchar(50),
  is_obsolete boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Cap de 10 MB (R5)
  CONSTRAINT candidate_attachments_size_cap CHECK (size_bytes > 0 AND size_bytes <= 10485760)
);

CREATE INDEX attachments_candidate_idx
  ON candidate_attachments (tenant_id, candidate_id)
  WHERE is_active = true AND NOT is_obsolete;

-- ========================================
-- candidate_duplicate_links — duplicados confirmados (data-model §3 / FR-015)
-- ========================================

CREATE TABLE candidate_duplicate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  candidate_id uuid NOT NULL REFERENCES candidates(id),
  duplicate_of_candidate_id uuid NOT NULL REFERENCES candidates(id),
  confirmed_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dup_links_candidate_idx
  ON candidate_duplicate_links (tenant_id, candidate_id);

CREATE INDEX dup_links_reverse_idx
  ON candidate_duplicate_links (tenant_id, duplicate_of_candidate_id);

-- ========================================
-- retention_reviews — bitácora anual LFPDPPP (data-model §8 / FR-003a)
-- ========================================

CREATE TABLE retention_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  reviewer_user_id uuid NOT NULL REFERENCES users(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  next_due_at timestamptz NOT NULL,
  justification_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX retention_reviews_tenant_due_idx
  ON retention_reviews (tenant_id, next_due_at DESC);
