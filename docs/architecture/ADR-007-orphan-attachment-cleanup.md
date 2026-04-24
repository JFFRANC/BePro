# ADR-007 — Limpieza de adjuntos huérfanos

- **Estado**: Aceptada (implementación diferida)
- **Fecha**: 2026-04-23
- **Responsables**: Equipo BePro
- **Feature**: 007-candidates-module
- **Tarea origen**: T123a en `specs/007-candidates-module/tasks.md`
- **Referencias**: `specs/007-candidates-module/contracts/candidates-api.md` §7 (bloque "Failure mode"), ADR-002 (proxy upload pattern)

## Contexto

El flujo de adjuntos tiene dos pasos (ver ADR-002):

1. `POST /api/candidates/:id/attachments` — crea una fila en `candidate_attachments` con `uploaded_at = NULL` y devuelve la URL interna de subida.
2. `POST /api/candidates/:id/attachments/:attId/upload` — el cliente envía los bytes; el Worker los escribe a R2 y marca `uploaded_at = now()`.

Si el paso 2 nunca ocurre (interrupción de red, crash del cliente, el usuario cierra la pestaña) queda una fila huérfana en la base de datos con `uploaded_at = NULL`. El filtro `uploaded_at IS NOT NULL` oculta la fila del listado de adjuntos (`GET /:id/attachments`), por lo que no aparece en la UI. Pero la fila **sí** existe en la tabla, y eventualmente se acumulan.

El objeto en R2 no se crea hasta que el paso 2 efectivamente escribe, así que huérfanos sólo hay a nivel de fila SQL — no a nivel de bucket (con la implementación actual, ADR-002). Si en el futuro migramos a presigned-PUT directo a R2, los huérfanos también aparecerían como objetos R2 sin fila SQL.

## Decisión

**Diferir** la implementación de un job programado de limpieza hasta que el volumen de huérfanos lo justifique. Mientras tanto, ofrecer **una pauta operativa SQL** para purgas manuales.

### Procedimiento operativo (hoy)

Ejecutar periódicamente (mensual, o cuando la métrica lo pida):

```sql
-- Huérfanos con más de 24 h: el upload nunca se completó.
DELETE FROM candidate_attachments
WHERE uploaded_at IS NULL
  AND created_at < now() - interval '24 hours';
```

Se puede hacer vía `pnpm -F @bepro/db db:query "..."` con rol administrativo. **No** se necesita coordinar con R2 porque los bytes nunca llegaron a subirse (ADR-002).

### Diseño futuro del cron (cuando toque)

Cuando activemos el job programado:

- **Trigger**: Cloudflare Workers Cron Trigger (`*/30 * * * *` — cada 30 min).
- **Scope**: por tenant; el job itera `tenants.is_active = true` y abre un `SET LOCAL app.tenant_id` por cada uno.
- **Criterio de borrado**: `uploaded_at IS NULL AND created_at < now() - interval '2 hours'`. El umbral de 2 h da margen amplio a uploads lentos reales.
- **Auditoría**: emite un evento `candidate.attachment.orphan_cleaned` en `audit_events` por cada fila eliminada, con `{actor_id: 'system'|null, tenant_id, target_id, action, from_value: <snapshot>, to_value: null}`. Esto satisface la constitución: ninguna modificación de estado sin rastro.
- **Idempotencia**: el job puede correr en paralelo (por tenant); el `DELETE` con `created_at < ...` es naturalmente idempotente.
- **Observabilidad**: contar filas eliminadas y exponer como métrica Workers Analytics Engine (`cleanup.orphans.deleted` etiquetada por tenant).

## Consecuencias

### Positivas

- **Sin deuda oculta**: documentamos el patrón y tenemos el playbook manual listo para operadores.
- **Zero overhead** en el MVP: no consumimos CPU time ni ticks de cron mientras el volumen sea bajo.
- **Migración limpia**: cuando activemos el job el diseño ya está especificado — no hay que redescubrirlo.

### Negativas

- **Ruido SQL**: la tabla `candidate_attachments` acumula filas huérfanas silenciosas hasta la siguiente purga manual. Con volumen bajo (MVP: decenas de subidas/día por tenant) es imperceptible.
- **Riesgo operativo**: si nadie ejecuta la purga manual en 6–12 meses, la tabla puede inflarse. Monitorear con una métrica simple (`SELECT count(*) FROM candidate_attachments WHERE uploaded_at IS NULL`) es el contrapeso.

### Neutrales

- Si en el futuro migramos a presigned-PUT directo a R2 (ADR-002 lo contempla), el cron deberá además limpiar objetos R2 — no sólo filas. Ese caso está fuera del alcance actual porque la implementación vigente no produce objetos huérfanos en R2.

## Cuándo activar el cron

Re-abrir este ADR y shipear el cron cuando cualquiera de estas se cumpla:

- La purga manual deba ejecutarse más de una vez por semana.
- `count(*) FROM candidate_attachments WHERE uploaded_at IS NULL` supere 100 por tenant.
- Un incidente legal/LFPDPPP requiera una garantía estricta de "ningún dato personal queda almacenado más allá del flujo activo" (improbable con `uploaded_at = NULL` porque el payload nunca subió, pero documentarlo).

## Alternativas consideradas

- **Constraint `uploaded_at NOT NULL`**: descartado porque contradiría la secuencia init → upload que necesita dos requests separadas (FR-040, FR-041). El flag `uploaded_at IS NULL` es intencional durante la ventana de subida.
- **Retención indefinida** (no limpiar nunca): descartado por consumo de almacenamiento y riesgo operativo.
- **Marcar como obsolete** en vez de DELETE: innecesariamente conservador — la fila nunca fue "un adjunto" desde el punto de vista del usuario; es un residuo técnico sin valor informativo.

## Notas de implementación

- Tabla afectada: `packages/db/src/schema/candidate-attachments.ts` — columna `uploaded_at`.
- El filtro de listado que oculta huérfanos vive en `apps/api/src/modules/candidates/service.ts` → `listAttachments` (buscar `uploaded_at IS NOT NULL`).
- Para el cron futuro: crear módulo en `apps/api/src/modules/maintenance/` cuando toque, NO mezclarlo con el módulo de candidates (Principio IV, modular por dominio).
