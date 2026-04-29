// Per-email rate-limit for password-reset requests, backed by Cloudflare KV.
// Keys are SHA-256(email_lowercased) so PII never lands in KV (research.md
// Decision 3).
//
// Budget: 1 accepted request / minute AND 5 / hour, per email. Throttled
// requests look identical to accepted ones at the route layer (FR-009).

const PER_MINUTE_LIMIT = 1;
const PER_HOUR_LIMIT = 5;
const PER_MINUTE_TTL_S = 60;
const PER_HOUR_TTL_S = 3600;

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function emailKey(scope: "minute" | "hour", emailHash: string): string {
  return `pwreset:${emailHash}:${scope}`;
}

/**
 * Atomically (best-effort, KV is eventually consistent) check + increment
 * the per-email counters. Returns `true` if the call is within both
 * budgets and counters were updated; `false` if either budget is exceeded
 * (in which case no counter is touched on the budget-exceeding scope, but
 * the under-budget scope is still incremented — the route doesn't care
 * because either way it returns the same body).
 */
export async function checkAndIncrementEmailRate(
  kv: KVNamespace,
  email: string,
): Promise<boolean> {
  const hash = await sha256Hex(email.trim().toLowerCase());
  const minuteKey = emailKey("minute", hash);
  const hourKey = emailKey("hour", hash);

  const [minuteRaw, hourRaw] = await Promise.all([
    kv.get(minuteKey),
    kv.get(hourKey),
  ]);
  const minuteCount = minuteRaw ? Number(minuteRaw) : 0;
  const hourCount = hourRaw ? Number(hourRaw) : 0;

  if (minuteCount >= PER_MINUTE_LIMIT || hourCount >= PER_HOUR_LIMIT) {
    return false;
  }

  // Increment both counters with their TTLs. KV doesn't have atomic INCR;
  // a concurrent burst can race past the budget by 1–2, which is acceptable
  // for a defensive throttle (research.md Decision 3).
  await Promise.all([
    kv.put(minuteKey, String(minuteCount + 1), {
      expirationTtl: PER_MINUTE_TTL_S,
    }),
    kv.put(hourKey, String(hourCount + 1), {
      expirationTtl: PER_HOUR_TTL_S,
    }),
  ]);

  return true;
}
