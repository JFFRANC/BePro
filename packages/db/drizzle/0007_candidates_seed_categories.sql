-- 007-candidates-module — paso 5: seed de catálogos por defecto y aviso de privacidad
-- Inserta categorías de rechazo/decline y un aviso de privacidad activo para cada tenant existente.
-- Idempotente: usa ON CONFLICT DO NOTHING contra los índices únicos parciales.

-- Catálogo por defecto de motivos de rechazo (R8)
INSERT INTO rejection_categories (tenant_id, label)
SELECT t.id, label
FROM tenants t
CROSS JOIN (VALUES
  ('No qualified'),
  ('Overqualified'),
  ('Salary mismatch'),
  ('Failed background check'),
  ('Cultural fit'),
  ('Other')
) AS defaults(label)
ON CONFLICT DO NOTHING;

-- Catálogo por defecto de motivos de decline (R8)
INSERT INTO decline_categories (tenant_id, label)
SELECT t.id, label
FROM tenants t
CROSS JOIN (VALUES
  ('Counter-offer accepted'),
  ('Moved location'),
  ('Role mismatch'),
  ('Compensation'),
  ('Withdrew without reason'),
  ('Other')
) AS defaults(label)
ON CONFLICT DO NOTHING;

-- Aviso de privacidad LFPDPPP por defecto (versión 2026-04). Texto en español.
INSERT INTO privacy_notices (tenant_id, version, text_md, effective_from, is_active)
SELECT t.id,
       '2026-04',
       E'# Aviso de Privacidad (LFPDPPP)\n\n' ||
       'BePro recopila tus datos personales (nombre, teléfono, correo, puesto actual y los datos adicionales que el cliente solicite) ' ||
       'con la finalidad exclusiva de gestionar tu candidatura para procesos de reclutamiento. ' ||
       'Tus datos serán tratados de forma confidencial conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). ' ||
       'Puedes ejercer tus derechos ARCO (Acceso, Rectificación, Cancelación, Oposición) escribiendo a privacidad@bepro.mx.',
       now(),
       true
FROM tenants t
ON CONFLICT DO NOTHING;
