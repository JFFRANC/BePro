# Research: Módulo de Clientes

**Feature**: 005-clients-module  
**Date**: 2026-04-15

## R1: Proveedor de mapas interactivos

**Decision**: MapLibre GL JS (mapa) + Mapbox Geocoding API (autocompletado de dirección)

**Rationale**:
- MapLibre GL JS es la bifurcación open-source de Mapbox GL JS — sin costo de licencia, renderizado WebGL, marcadores arrastrables.
- `react-map-gl` (v7) soporta MapLibre como drop-in con la misma API.
- Mapbox Geocoding API ofrece 100k solicitudes/mes gratis — más que suficiente para un equipo de ~20 reclutadores.
- Excelente precisión para direcciones mexicanas a nivel de colonia y código postal.
- Tiles gratuitos de OpenStreetMap o MapTiler free tier.
- Compatible con el presupuesto de $0-25/mes.

**Alternatives considered**:
- Leaflet + OSM: Funcional pero sin WebGL; menos fluido para interacción con mapas.
- Google Maps Platform: $200 crédito/mes pero excesivo; el crédito se consume rápido con Places API.
- Nominatim (geocoder): Precisión pobre-moderada para direcciones mexicanas, especialmente colonias.

## R2: Almacenamiento de documentos (Cloudflare R2)

**Decision**: Upload a través del Worker (proxy), no presigned URLs. Servir archivos también a través del Worker.

**Rationale**:
- Workers tienen un límite de body de 128 MB (no 10 MB) — 10 MB está cómodamente dentro del límite.
- Upload por Worker permite validar MIME type, aplicar aislamiento por tenant, generar la key y registrar metadata en DB en una sola request.
- Presigned URLs requieren que `r2.cloudflarestorage.com` sea accesible públicamente desde el browser, bypasseando JWT auth y tenant-scope.
- No se requiere hacer el bucket público — todos los accesos van a través de rutas autenticadas del Worker.

**Key structure**: `{tenant_id}/clients/{client_id}/documents/{uuid}.{ext}`

**Implementation details**:
- Binding R2 en `wrangler.jsonc`: `"r2_buckets": [{ "binding": "FILES", "bucket_name": "bepro-files" }]`
- Extender `Bindings` en `types.ts`: agregar `FILES: R2Bucket`
- MIME validation allowlist: `application/pdf`, `image/png`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Servir descargas: `Content-Disposition: attachment` (PDFs, XLSX) o `inline` (PNG preview)

**Alternatives considered**:
- Presigned URLs: Mejor para archivos muy grandes (100 MB+) o alto volumen — no aplica aquí.
- Bucket público con paths firmados: Menor complejidad pero rompe el modelo de aislamiento por tenant.

## R3: Patrón de autorización para sub-recursos

**Decision**: Middleware de verificación de asignación al cliente para ejecutivos de cuenta.

**Rationale**:
- Para sub-recursos (contactos, puestos, documentos), los ejecutivos de cuenta solo pueden gestionar los de sus clientes asignados.
- Se necesita un middleware/helper que verifique que el usuario actual tiene asignación al `client_id` del request.
- Admin bypasses la verificación (ve todo dentro del tenant).
- Manager puede ver pero no crear/editar/eliminar sub-recursos (consistent con FR-014).

**Pattern**:
```
requireRole("admin", "account_executive") → verifyClientAccess(clientId) → handler
```

## R4: Soft delete vs Hard delete por entidad

**Decision**: Diferenciado por tipo de entidad.

| Entidad | Tipo de eliminación | Razón |
|---------|-------------------|-------|
| Client | Soft delete (`is_active`) | PII indirecto + referencia histórica |
| Client Assignment | Hard delete | Relación sin valor histórico |
| Client Contact | Hard delete | Contactos comerciales, no PII protegido por LFPDPPP |
| Client Position | Soft delete si tiene candidatos, hard delete si no | Preservar referencia histórica |
| Client Document | Hard delete (DB) + R2 delete | Archivo y registro se eliminan completamente |
