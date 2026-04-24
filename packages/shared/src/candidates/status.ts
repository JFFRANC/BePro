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

export function statusLabel(status: CandidateStatus): string {
  return CANDIDATE_STATUS_LABELS[status];
}
