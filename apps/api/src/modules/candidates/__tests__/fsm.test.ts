import { describe, it, expect } from "vitest";
import {
  assertLegalTransition,
  assertRoleAllowsTransition,
  legalNextStatesFor,
  TransitionError,
} from "../fsm.js";
import {
  CANDIDATE_STATUSES,
  FSM_LEGAL_EDGES,
  type CandidateStatus,
} from "@bepro/shared";

describe("FSM — legal edges", () => {
  it("accepts every edge declared in FSM_LEGAL_EDGES", () => {
    for (const from of CANDIDATE_STATUSES) {
      for (const to of FSM_LEGAL_EDGES[from]) {
        expect(() => assertLegalTransition(from, to)).not.toThrow();
      }
    }
  });

  it("refuses every undeclared edge with TransitionError", () => {
    for (const from of CANDIDATE_STATUSES) {
      const allowed = new Set<CandidateStatus>(FSM_LEGAL_EDGES[from]);
      for (const to of CANDIDATE_STATUSES) {
        if (allowed.has(to)) continue;
        expect(() => assertLegalTransition(from, to)).toThrow(TransitionError);
      }
    }
  });

  it("forbids skipping states (registered → hired)", () => {
    expect(() => assertLegalTransition("registered", "hired")).toThrow(
      TransitionError,
    );
  });

  it("forbids attended → hired (must go through approved)", () => {
    expect(() => assertLegalTransition("attended", "hired")).toThrow(
      TransitionError,
    );
  });

  it("FR-031a — Rejected only from interview_scheduled/attended/pending/approved", () => {
    const validFrom = new Set<CandidateStatus>([
      "interview_scheduled",
      "attended",
      "pending",
      "approved",
    ]);
    for (const from of CANDIDATE_STATUSES) {
      const ok = validFrom.has(from);
      const fn = () => assertLegalTransition(from, "rejected");
      ok ? expect(fn).not.toThrow() : expect(fn).toThrow(TransitionError);
    }
  });

  it("FR-031a — Declined only from approved", () => {
    for (const from of CANDIDATE_STATUSES) {
      const fn = () => assertLegalTransition(from, "declined");
      from === "approved"
        ? expect(fn).not.toThrow()
        : expect(fn).toThrow(TransitionError);
    }
  });

  it("FR-031a — No Show only from interview_scheduled", () => {
    for (const from of CANDIDATE_STATUSES) {
      const fn = () => assertLegalTransition(from, "no_show");
      from === "interview_scheduled"
        ? expect(fn).not.toThrow()
        : expect(fn).toThrow(TransitionError);
    }
  });

  it("FR-031a — Discarded only from non-terminal states", () => {
    const valid = new Set<CandidateStatus>([
      "registered",
      "interview_scheduled",
      "attended",
      "pending",
      "approved",
    ]);
    for (const from of CANDIDATE_STATUSES) {
      const fn = () => assertLegalTransition(from, "discarded");
      valid.has(from)
        ? expect(fn).not.toThrow()
        : expect(fn).toThrow(TransitionError);
    }
  });
});

describe("FSM — legalNextStatesFor", () => {
  it("returns the allowed list for a non-terminal state", () => {
    const next = legalNextStatesFor("registered");
    expect(next).toContain("interview_scheduled");
    expect(next).toContain("discarded");
    expect(next).not.toContain("hired");
  });

  it("returns empty array for negative terminals", () => {
    expect(legalNextStatesFor("rejected")).toEqual([]);
    expect(legalNextStatesFor("declined")).toEqual([]);
  });
});

describe("FSM — role gate (FR-032/033/034)", () => {
  const candidate = {
    id: "c1",
    client_id: "client-A",
    status: "registered" as CandidateStatus,
  };

  it("FR-032 — recruiter cannot transition any candidate", () => {
    expect(() =>
      assertRoleAllowsTransition({
        role: "recruiter",
        userId: "u1",
        clientAssignments: [],
        candidate,
        toStatus: "interview_scheduled",
      }),
    ).toThrow(TransitionError);
  });

  it("FR-033 — AE only transitions own clients", () => {
    expect(() =>
      assertRoleAllowsTransition({
        role: "account_executive",
        userId: "u2",
        clientAssignments: ["other-client"],
        candidate,
        toStatus: "interview_scheduled",
      }),
    ).toThrow(TransitionError);

    expect(() =>
      assertRoleAllowsTransition({
        role: "account_executive",
        userId: "u2",
        clientAssignments: ["client-A"],
        candidate,
        toStatus: "interview_scheduled",
      }),
    ).not.toThrow();
  });

  it("FR-034 — manager and admin can transition any candidate in tenant", () => {
    for (const role of ["manager", "admin"] as const) {
      expect(() =>
        assertRoleAllowsTransition({
          role,
          userId: "u3",
          clientAssignments: [],
          candidate,
          toStatus: "interview_scheduled",
        }),
      ).not.toThrow();
    }
  });
});
