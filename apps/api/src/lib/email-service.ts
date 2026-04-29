// Feature 009 — outbound email transport with environment-aware suppression.
// See research.md Decision 9 and FR-018.

import type { Bindings } from "../types.js";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailService {
  send(args: SendEmailArgs): Promise<void>;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/\S+/);
  return match ? match[0] : null;
}

export class ResendEmailService implements EmailService {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  async send(args: SendEmailArgs): Promise<void> {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
    });

    if (!res.ok) {
      // Throw a transport error without leaking the recipient or response body.
      // The caller is responsible for catching and logging without PII.
      throw new Error(`resend_transport_error_${res.status}`);
    }
  }
}

export class SuppressedEmailService implements EmailService {
  async send(args: SendEmailArgs): Promise<void> {
    // Structured event consumed by Wrangler tail. Carries `to` by design
    // (FR-018 — local-dev affordance, never enabled in production).
    console.log(
      JSON.stringify({
        event: "email.suppressed",
        to: args.to,
        subject: args.subject,
        urlPreview: extractFirstUrl(args.text),
      }),
    );
  }
}

export function getEmailService(env: Bindings): EmailService {
  if (env.RESEND_API_KEY && env.RESEND_FROM_DOMAIN) {
    return new ResendEmailService(env.RESEND_API_KEY, env.RESEND_FROM_DOMAIN);
  }
  return new SuppressedEmailService();
}
