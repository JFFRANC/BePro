# ADR-002 — Carga de adjuntos vía proxy en Workers (en lugar de PUT pre-firmado directo a R2)

- **Estado**: Aceptada
- **Fecha**: 2026-04-23
- **Responsables**: Equipo BePro
- **Feature**: 007-candidates-module
- **Supersede**: N/A
- **Referencias**: `specs/007-candidates-module/research.md` §R4, `specs/007-candidates-module/contracts/candidates-api.md` §6–§7, `specs/007-candidates-module/spec.md` FR-040/FR-041

## Contexto

La investigación inicial (research R4) propuso el patrón clásico para subida de archivos sobre R2:

1. Cliente → `POST /api/candidates/:id/attachments` → servidor responde con **URL pre-firmado PUT** apuntando directo al bucket R2 (validez ~10 min).
2. Cliente hace el PUT del binario directamente a R2.
3. Cliente → `POST /api/candidates/:id/attachments/:attId/complete` → servidor marca `uploaded_at = now()` y emite el evento de auditoría.

Ese patrón minimiza el consumo de CPU del Worker porque los bytes nunca atraviesan el runtime. Pero trae complejidad importante:

- **CORS**: el bucket R2 necesita reglas CORS explícitas para el dominio web; cambios de dominio (preview deploys) rompen la subida silenciosamente.
- **Firma de URL**: la generación del URL pre-firmado requiere cliente SDK R2/S3 instanciado dentro del Worker (`@aws-sdk/s3-request-presigner`) o código manual de firma AWS SigV4.
- **Validación diferida**: el Worker no puede rechazar bytes malformados durante la subida — sólo valida antes (`POST /attachments`) y después (`/complete`). Un cliente malicioso puede subir cualquier cosa hasta que se firme el tamaño.
- **UX dividida**: un fallo a mitad del PUT deja una fila huérfana en `candidate_attachments` y potencialmente un objeto huérfano en R2 (ver ADR-007).

Durante la implementación de 007 se decidió un patrón alternativo: **subir los bytes a través del Worker** usando el binding `FILES` (R2) directamente.

## Decisión

Adoptar el patrón de **proxy**: el cliente hace **una sola** llamada `POST /api/candidates/:id/attachments/:attId/upload` con el binario en el body crudo; el Worker valida MIME + tamaño, escribe el objeto en R2 vía el binding, marca `uploaded_at`, y emite `candidate.attachment.added` en `audit_events`. Todo en la misma request.

Mientras tanto, la llamada inicial `POST /api/candidates/:id/attachments` crea la fila con `uploaded_at = NULL` y devuelve un `upload_url` **interno** al mismo endpoint del Worker, así el frontend puede conservar la forma de dos pasos sin conocer los detalles.

La variante de PUT pre-firmado directo a R2 queda documentada como optimización futura.

## Consecuencias

### Positivas

- **Sin CORS**: toda la subida pasa por el mismo dominio de la API, reutilizando el CORS existente.
- **Validación activa**: el Worker puede rechazar con 422 apenas detecta MIME inválido o tamaño > 10 MB, sin "colgar" bytes en R2.
- **Autorización uniforme**: la subida comparte el mismo middleware JWT + `SET LOCAL app.tenant_id` que las demás rutas; no hay un camino alterno que deba replicar las reglas.
- **Sin clientes SDK adicionales**: el Worker usa solo el binding `FILES.put(key, body, opts)` — ya disponible en `@cloudflare/workers-types`.
- **Orquestación simple**: un fallo en medio de la subida revierte toda la transacción (fila + evento de auditoría), porque todo ocurre en una sola request.

### Negativas

- **CPU del Worker**: los bytes atraviesan el runtime. Con el tope de 10 MB/archivo (FR-018), el costo por subida es acotado pero no despreciable (Cloudflare cobra CPU time por request).
- **Egress**: la subida consume ingress de Workers y egress hacia R2 en la misma request. Para volúmenes bajos (el perfil inicial del MVP) es irrelevante; para volúmenes altos habrá que medir.
- **Latencia percibida**: una única request más larga en vez de dos requests más cortas + un PUT "directo" al edge. Para archivos < 5 MB la diferencia es imperceptible en condiciones normales.

### Neutrales

- La forma del contrato (dos endpoints: `POST /attachments` + `POST /attachments/:attId/upload`) se preserva en la documentación para que un futuro switch al patrón pre-firmado sea un cambio interno, no de API pública.

## Cuándo reconsiderar

Re-abrir este ADR y evaluar el switch a PUT pre-firmado directo a R2 cuando cualquiera de estas condiciones se cumpla:

- Volumen sostenido de subidas > 100 MB/min en producción.
- Las subidas de adjuntos aparezcan en el top-3 de consumidores de CPU time del Worker según métricas de Cloudflare Analytics.
- El tope por archivo (FR-018) suba de 10 MB a > 25 MB.
- Se agregue un requisito de "resumable uploads" (TUS o equivalente) que sea mucho más natural sobre R2 directo.

## Alternativas consideradas

- **Presigned PUT + `/complete` (R4)**: descrita arriba. Rechazada por los motivos listados en Contexto — principalmente CORS + SDK de firma.
- **TUS protocol (resumable)**: descartado como out-of-scope para el MVP; los adjuntos esperados son ≤ 10 MB y no hay requisito de reanudación.
- **Direct upload token endpoint**: generar un token firmado específico para el binding FILES y permitir upload directo desde el cliente al endpoint `/upload` con ese token. Demasiado setup para la ganancia marginal en este volumen.

## Notas de implementación

- Ruta del endpoint proxy: `apps/api/src/modules/candidates/routes.ts` (buscar `/:id/attachments/:attId/upload`).
- Helper de R2: `apps/api/src/modules/candidates/storage.ts` — expone `storageKey()` y es el único lugar que toca el binding `FILES`.
- Tope de tamaño y MIME válidos: constantes en `packages/shared/src/candidates/schemas.ts` (evitar magic numbers en los handlers).
