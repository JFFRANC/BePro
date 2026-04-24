// 007-candidates-module — validador del FSM y gate por rol (R1 / FR-031..034 / FR-031a)
import {
  FSM_LEGAL_EDGES,
  type CandidateStatus,
} from "@bepro/shared";
import type { UserRole } from "@bepro/shared";

export class TransitionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "fsm_illegal"
      | "role_forbidden"
      | "scope_forbidden",
    public readonly status: 403 | 422 = 422,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

// Capa A (R1): edge legal del FSM (ignorando rol/asignaciones).
export function assertLegalTransition(
  from: CandidateStatus,
  to: CandidateStatus,
): void {
  const allowed = FSM_LEGAL_EDGES[from] ?? [];
  if (!allowed.includes(to)) {
    throw new TransitionError(
      `Transición no permitida: ${from} → ${to}.`,
      "fsm_illegal",
      422,
    );
  }
}

export function legalNextStatesFor(
  from: CandidateStatus,
): ReadonlyArray<CandidateStatus> {
  return FSM_LEGAL_EDGES[from] ?? [];
}

export interface RoleGateInput {
  role: UserRole;
  userId: string;
  clientAssignments: ReadonlyArray<string>;
  candidate: { id: string; client_id: string; status: CandidateStatus };
  toStatus: CandidateStatus;
}

// Capa B (R1): gate por rol y asignaciones de cliente.
export function assertRoleAllowsTransition(input: RoleGateInput): void {
  const { role, candidate, clientAssignments } = input;

  // FR-032 — recruiter (cualquier flag) no puede transicionar
  if (role === "recruiter") {
    throw new TransitionError(
      "Los reclutadores no pueden cambiar el estado del candidato.",
      "role_forbidden",
      403,
    );
  }

  // FR-033 — account_executive sólo en sus clientes asignados
  if (role === "account_executive") {
    if (!clientAssignments.includes(candidate.client_id)) {
      throw new TransitionError(
        "No tienes asignado este cliente.",
        "scope_forbidden",
        403,
      );
    }
    return;
  }

  // FR-034 — manager y admin pueden transicionar cualquier candidato del tenant
  if (role === "manager" || role === "admin") {
    return;
  }

  throw new TransitionError(
    `Rol no autorizado: ${role}`,
    "role_forbidden",
    403,
  );
}
