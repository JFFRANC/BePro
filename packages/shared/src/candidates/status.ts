// 007-candidates-module — FSM de candidatos (R1 / data-model §4)

export const CANDIDATE_STATUSES = [
  "registered",
  "interview_scheduled",
  "attended",
  "pending",
  "approved",
  "hired",
  "in_guarantee",
  "guarantee_met",
  "rejected",
  "declined",
  "no_show",
  "termination",
  "discarded",
  "replacement",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

// Estados terminales negativos: alcanzar uno marca is_active=false (FR-038)
export const NEGATIVE_TERMINAL_STATUSES: ReadonlySet<CandidateStatus> = new Set([
  "rejected",
  "declined",
  "no_show",
  "discarded",
  "termination",
  "replacement",
]);

// Estados terminales positivos: mantienen is_active=true (FR-038)
export const POSITIVE_TERMINAL_STATUSES: ReadonlySet<CandidateStatus> = new Set([
  "hired",
  "in_guarantee",
  "guarantee_met",
]);

export const TERMINAL_STATUSES: ReadonlySet<CandidateStatus> = new Set([
  ...NEGATIVE_TERMINAL_STATUSES,
  ...POSITIVE_TERMINAL_STATUSES,
]);

export function isTerminalStatus(status: CandidateStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isNegativeTerminal(status: CandidateStatus): boolean {
  return NEGATIVE_TERMINAL_STATUSES.has(status);
}

export function isPositiveTerminal(status: CandidateStatus): boolean {
  return POSITIVE_TERMINAL_STATUSES.has(status);
}

// Aristas legales del FSM. Un par (from -> to) es válido si y sólo si está en este mapa.
// Derivado de R1 + FR-031a (matriz de terminales negativos clarificada en sesión 2026-04-21).
export const FSM_LEGAL_EDGES: Readonly<
  Record<CandidateStatus, ReadonlyArray<CandidateStatus>>
> = {
  registered: ["interview_scheduled", "discarded"],
  interview_scheduled: [
    "attended",
    "rejected",
    "no_show",
    "discarded",
  ],
  attended: ["pending", "rejected", "discarded"],
  pending: ["approved", "interview_scheduled", "rejected", "discarded"],
  approved: [
    "hired",
    "pending",
    "interview_scheduled",
    "rejected",
    "declined",
    "discarded",
  ],
  hired: ["in_guarantee"],
  in_guarantee: ["guarantee_met", "termination"],
  guarantee_met: [],
  rejected: [],
  declined: [],
  no_show: [],
  termination: ["replacement"],
  discarded: [],
  replacement: [],
} as const;

export function isLegalTransition(
  from: CandidateStatus,
  to: CandidateStatus,
): boolean {
  return FSM_LEGAL_EDGES[from]?.includes(to) ?? false;
}

// Etiquetas TitleCase para la UI (data-model §4 — case mapping)
// Kept for audit payloads and logs (enum tokens are canonical).
export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  registered: "Registered",
  interview_scheduled: "Interview Scheduled",
  attended: "Attended",
  pending: "Pending",
  approved: "Approved",
  hired: "Hired",
  in_guarantee: "In Guarantee",
  guarantee_met: "Guarantee Met",
  rejected: "Rejected",
  declined: "Declined",
  no_show: "No Show",
  termination: "Termination",
  discarded: "Discarded",
  replacement: "Replacement",
};

// 008-ux-roles-refinements / US4 — Spanish labels for end-user UI (FR-LC-002).
// Single source of truth for the 14 FSM state labels. Missing entries fall
// through to the English token with a runtime warning.
export const CANDIDATE_STATUS_LABELS_ES: Record<CandidateStatus, string> = {
  registered: "Registrado",
  interview_scheduled: "Entrevista programada",
  attended: "Asistió a entrevista",
  pending: "En revisión",
  approved: "Aprobado",
  hired: "Contratado",
  in_guarantee: "En periodo de garantía",
  guarantee_met: "Garantía cumplida",
  rejected: "Rechazado",
  declined: "Declinado",
  no_show: "No asistió",
  termination: "Terminado",
  discarded: "Descartado",
  replacement: "En reemplazo",
};

export type CandidateStatusLang = "es" | "en";

export function statusLabel(
  status: CandidateStatus,
  lang: CandidateStatusLang = "es",
): string {
  const map =
    lang === "en" ? CANDIDATE_STATUS_LABELS : CANDIDATE_STATUS_LABELS_ES;
  const label = map[status];
  if (!label) {
    // Surfaced in CI by packages/shared/src/candidates/__tests__/status.labels.test.ts
    // and at runtime for any future enum value added without a label entry.
    if (typeof console !== "undefined") {
      console.warn(`[statusLabel] Missing ${lang} label for status: ${status}`);
    }
    return status;
  }
  return label;
}

// 008-ux-roles-refinements / US3 — Group kind for the inline transition menu.
// Drives the "Avanzar / Rechazar / Declinar / Reactivar" visual grouping.
export type TransitionCategory =
  | "advance"
  | "reject"
  | "decline"
  | "reactivate";

export interface TransitionOption {
  nextStatus: CandidateStatus;
  labelEs: string;
  category: TransitionCategory;
  requiresCategory: boolean;
}

const REJECT_TARGETS: ReadonlySet<CandidateStatus> = new Set([
  "rejected",
  "no_show",
  "discarded",
]);
const DECLINE_TARGETS: ReadonlySet<CandidateStatus> = new Set(["declined"]);
const REACTIVATE_TARGETS: ReadonlySet<CandidateStatus> = new Set([
  "replacement",
]);

function categorize(next: CandidateStatus): TransitionCategory {
  if (REJECT_TARGETS.has(next)) return "reject";
  if (DECLINE_TARGETS.has(next)) return "decline";
  if (REACTIVATE_TARGETS.has(next)) return "reactivate";
  return "advance";
}

/**
 * Roles accepted by `transitionOptionsFor`. Keeps shared/status.ts free of
 * importing the full auth types (UserRole lives elsewhere).
 */
export type TransitionActorRole =
  | "admin"
  | "manager"
  | "account_executive"
  | "recruiter";

/**
 * Returns the inline-menu options from `current` for a given actor role.
 * Mirrors the server-side role gate in `apps/api/src/modules/candidates/fsm.ts`:
 *   - recruiter: cannot transition at all (FR-032) → empty array.
 *   - account_executive / manager / admin: all FSM-valid transitions.
 *     (AE client-scope is re-checked by the server on commit.)
 */
export function transitionOptionsFor(
  current: CandidateStatus,
  role?: TransitionActorRole,
): TransitionOption[] {
  if (role === "recruiter") return [];
  const next = FSM_LEGAL_EDGES[current] ?? [];
  return next.map((nextStatus) => {
    const category = categorize(nextStatus);
    return {
      nextStatus,
      labelEs: statusLabel(nextStatus, "es"),
      category,
      requiresCategory: category === "reject" || category === "decline",
    };
  });
}
