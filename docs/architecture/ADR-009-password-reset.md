# ADR-009: Password Reset (autoservicio)

## Estado: Aprobado

## Fecha: 2026-04-28

## Contexto

Hasta antes de la feature 009, los usuarios sin acceso a su contraseña dependían de que un administrador la rotara manualmente y entregara el flag `must_change_password = true` para forzar el cambio en el siguiente login. Eso bloquea a los reclutadores externos los fines de semana, satura al equipo de soporte y deja una superficie operativa peligrosa: una persona con permiso de admin puede setear cualquier contraseña sin trazabilidad real (la auditoría sólo registra el cambio, no el motivo). El spec 009 introduce un flujo de autoservicio con enlace tokenizado, mismo patrón que el resto de los SaaS modernos.

Decisiones de diseño documentadas en `specs/009-password-reset/research.md`. Esta ADR resume las 10 decisiones más relevantes y las alternativas descartadas, para servir de referencia rápida en revisiones futuras.

## Decisiones

1. **Transporte de email — Resend vía `fetch`.** Llamamos `POST https://api.resend.com/emails` directamente desde el Worker; sin SDK. Mantiene el bundle ligero, encaja con §II Edge-First, y la verificación de dominio se hace con CNAMEs en Cloudflare. Se descartaron Postmark/SendGrid/SES (todos viables, Resend ganó por ergonomía Cloudflare-first y precio simple) y el SDK de Resend (~30 KB innecesarios).

2. **Formato de token — 32 bytes URL-safe base64 (43 chars).** Almacenamos solo `SHA-256(token)` (hex en lowercase, 64 chars). 256 bits eliminan el presupuesto de adivinanza. Comparación equivalente vía índice Postgres (no hace falta `crypto.timingSafeEqual` en JS porque la comparación nunca corre en JS — la igualdad la resuelve el índice). Se descartaron UUIDv4 (122 bits, encoding inconsistente) y `bcrypt(token)` (overkill para una entrada de alta entropía).

3. **Rate-limit — KV namespace `PASSWORD_RESET_RATE`.** Llaves `pwreset:{sha256(email_lowercased)}:{minute|hour}`, presupuestos 1/min y 5/hour, TTLs 60 s y 3600 s. Email se hashea para que KV nunca contenga PII en plano. Descartados Durable Objects (overkill, defensive throttle tolera consistencia eventual de KV), tabla Postgres (write-hot row) y Cloudflare Rate-Limiting Rules (opera por IP, no protege contra rotación de IPs sobre el mismo email).

4. **Limpieza — Cloudflare Cron Trigger diaria a las 03:00 UTC.** Borra hard `password_reset_tokens` con `used_at IS NOT NULL OR expires_at < now()`. Se descartó cleanup-on-write (las filas expiradas-pero-nunca-usadas se acumularían), `pg_cron` (no disponible en Neon), y horario por hora (sin beneficio operativo).

5. **Migración de unicidad de email.** `users.email` pasa de `(tenant_id, email)` único a globalmente único. Audit query previo (`SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1`) en `BEGIN; ... COMMIT;` para que un fallo no deje el esquema en estado inconsistente. La constitución se actualizó en un PATCH separado (1.0.3) para reflejar el invariante.

6. **Eventos de auditoría — `password_reset_requested` + `password_reset_completed`.** Reusan la tabla `audit_events` existente. `actor_id = user.id` (auto-servicio → el actor es el propio usuario). `old_values = new_values = NULL` porque el único cambio es el hash de contraseña, y §VI prohíbe loguear PII derivada de él. Solo se inserta una fila cuando el email resuelve a un usuario activo — la tabla de auditoría no debe ser un oráculo de enumeración (FR-011).

7. **Anti-enumeración por timing.** El endpoint de request siempre resuelve el usuario; en el camino "miss / inactivo" hace un `SHA-256(DUMMY_BUF)` + un `kv.put("pwreset:_noop", ...)` no-op antes de retornar el mismo 200. Las distribuciones de latencia se solapan con la del happy path. Descartado random-sleep (filtra info por la forma de la distribución, hurts UX) y "throwaway token" (paridad casi perfecta pero costo de DB proporcional al ataque).

8. **Atomicidad del confirm.** Una sola transacción Drizzle ejecuta: lookup de token + lookup de usuario + UPDATE de `users` (passwordHash + clear de lockout/contadores + must_change_password=false), revoke de todos los `refresh_tokens` activos del usuario, mark del token como `used`, e inserción de la fila de auditoría `password_reset_completed`. El nuevo refresh token se inserta *después* de la transacción para sobrevivir al revoke.

9. **`EmailService` con dos implementaciones.** `ResendEmailService` (production), `SuppressedEmailService` (logs `email.suppressed` con `to`/`subject`/`urlPreview` — exclusivo de dev). Factory `getEmailService(env)` ramifica si `RESEND_API_KEY` y `RESEND_FROM_DOMAIN` están seteados. La excepción de PII para `to` está limitada al evento de suppression (FR-018) y existe sólo en dev; el guard test de no-PII en logs (T058a) la trata como única lista blanca.

10. **Páginas web — validación solo on-submit; sin endpoint de `verify`.** En 400 del confirm, la página renderiza la copia inline en español ("El enlace ha expirado o ya fue utilizado") y un botón "Solicitar otro enlace" que va a `/forgot-password`. Aclarado en `/speckit.clarify` Q4. Sin oráculo de probe ⇒ menos superficie de ataque.

## Boundaries de módulo (§IV)

`generateAccessToken` ya estaba exportado desde `apps/api/src/modules/auth/service.ts` antes de esta feature, por lo que el módulo `password-reset` lo consume sin necesidad de ampliar la superficie pública del módulo `auth`. La excepción §IV anticipada en el plan (`ADR-009 §"Module boundaries"`) resultó ser un no-op en la implementación final — la documentamos aquí para que un revisor futuro no se confunda.

Las constantes de acción de auditoría (`PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`) viven module-local en `password-reset/service.ts`; `lib/audit.ts` no se modifica (F8 del análisis del spec).

## Consecuencias

- Una nueva tabla `password_reset_tokens` con tres índices (`token_hash`, `user_id`, `expires_at`), explicitamente sin RLS — refleja el patrón de `refresh_tokens` (sin contexto de tenant en pre-auth, ownership por FK al usuario).
- `users.email` ahora es globalmente único; Constitución v1.0.3 lo refleja.
- Una nueva binding KV (`PASSWORD_RESET_RATE`) y un nuevo Cron Trigger en producción.
- Tres nuevos secrets en Workers (`RESEND_API_KEY`, `RESEND_FROM_DOMAIN`, `APP_URL`); en dev son opcionales (la suppression cubre el ciclo de desarrollo).
- Dos rutas web públicas: `/forgot-password` y `/reset-password`. Ningún cambio en la sesión persistente más allá del normal post-login.
- El daily cleanup cron borra filas hard (no soft-delete). LFPDPPP no aplica al token mismo: no es PII, sólo un secret de un solo uso.

## Referencias

- Spec: `specs/009-password-reset/spec.md`
- Plan: `specs/009-password-reset/plan.md`
- Research: `specs/009-password-reset/research.md`
- Data model: `specs/009-password-reset/data-model.md`
- Contratos OpenAPI: `specs/009-password-reset/contracts/password-reset.openapi.yaml`
- Quickstart: `specs/009-password-reset/quickstart.md`
- Tasks: `specs/009-password-reset/tasks.md`
- Constitución 1.0.3 (PATCH): `.specify/memory/constitution.md`
