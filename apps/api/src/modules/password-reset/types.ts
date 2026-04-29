import type { AuthResult } from "../auth/types.js";

export interface IssueTokenInput {
  email: string;
}

export interface IssueTokenResult {
  // Always-true on the public response. Internal `dispatched` is for tests.
  dispatched: boolean;
}

export type ConfirmTokenResult =
  | { ok: true; auth: AuthResult }
  | { ok: false; reason: "invalid_or_expired" };
