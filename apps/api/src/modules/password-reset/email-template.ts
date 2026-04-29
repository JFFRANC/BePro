// Feature 009 — Spanish password-reset email template.
// LFPDPPP §VI: only the user's first name and the reset URL appear in the body.
// No password, no token hash, no other PII.

export interface BuildResetEmailArgs {
  recipientName: string;
  resetUrl: string;
}

export interface BuildResetEmailResult {
  subject: string;
  html: string;
  text: string;
}

const SUBJECT = "Restablecer tu contraseña en BePro";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildResetEmail(
  args: BuildResetEmailArgs,
): BuildResetEmailResult {
  const safeName = escapeHtml(args.recipientName);
  const safeUrl = escapeHtml(args.resetUrl);

  const html = `<!DOCTYPE html>
<html lang="es">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5;">
    <p>Hola ${safeName},</p>
    <p>Recibimos una solicitud para restablecer tu contraseña en BePro. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
    <p><a href="${safeUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Restablecer mi contraseña</a></p>
    <p>Si el botón no funciona, copia y pega esta URL en tu navegador:</p>
    <p style="word-break: break-all; color: #6b7280;">${safeUrl}</p>
    <p>Este enlace expira en 30 minutos y solo puede usarse una vez.</p>
    <p>Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.</p>
    <p>— Equipo BePro</p>
  </body>
</html>`;

  const text = `Hola ${args.recipientName},

Recibimos una solicitud para restablecer tu contraseña en BePro. Abre el siguiente enlace para crear una nueva contraseña:

${args.resetUrl}

Este enlace expira en 30 minutos y solo puede usarse una vez.

Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá siendo válida.

— Equipo BePro`;

  return { subject: SUBJECT, html, text };
}
