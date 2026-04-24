import { describe, it, expect } from "vitest";
import {
  CANDIDATE_STATUSES,
  FSM_LEGAL_EDGES,
  NEGATIVE_TERMINAL_STATUSES,
  POSITIVE_TERMINAL_STATUSES,
  isLegalTransition,
  isNegativeTerminal,
  isPositiveTerminal,
  type CandidateStatus,
} from "../status.js";

describe("FSM legal edges (R1 + FR-031a)", () => {
  it("has an entry for every status in the enum", () => {
    for (const s of CANDIDATE_STATUSES) {
      expect(FSM_LEGAL_EDGES).toHaveProperty(s);
    }
  });

  it("happy path edges exist", () => {
    expect(isLegalTransition("registered", "interview_scheduled")).toBe(true);
    expect(isLegalTransition("interview_scheduled", "attended")).toBe(true);
    expect(isLegalTransition("attended", "pending")).toBe(true);
    expect(isLegalTransition("pending", "approved")).toBe(true);
    expect(isLegalTransition("approved", "hired")).toBe(true);
    expect(isLegalTransition("hired", "in_guarantee")).toBe(true);
    expect(isLegalTransition("in_guarantee", "guarantee_met")).toBe(true);
  });

  it("recovery loops exist", () => {
    expect(isLegalTransition("pending", "interview_scheduled")).toBe(true);
    expect(isLegalTransition("approved", "pending")).toBe(true);
    expect(isLegalTransition("approved", "interview_scheduled")).toBe(true);
  });

  it("FR-031a — negative-terminal matrix is exact", () => {
    expect(isLegalTransition("interview_scheduled", "rejected")).toBe(true);
    expect(isLegalTransition("attended", "rejected")).toBe(true);
    expect(isLegalTransition("pending", "rejected")).toBe(true);
    expect(isLegalTransition("approved", "rejected")).toBe(true);
    expect(isLegalTransition("registered", "rejected")).toBe(false);

    expect(isLegalTransition("approved", "declined")).toBe(true);
    expect(isLegalTransition("pending", "declined")).toBe(false);

    expect(isLegalTransition("interview_scheduled", "no_show")).toBe(true);
    expect(isLegalTransition("attended", "no_show")).toBe(false);

    for (const from of [
      "registered",
      "interview_scheduled",
      "attended",
      "pending",
      "approved",
    ] as CandidateStatus[]) {
      expect(isLegalTransition(from, "discarded")).toBe(true);
    }
    for (const from of ["hired", "rejected", "declined"] as CandidateStatus[]) {
      expect(isLegalTransition(from, "discarded")).toBe(false);
    }
  });

  it("forbids skipping registered → hired", () => {
    expect(isLegalTransition("registered", "hired")).toBe(false);
  });

  it("post-hired branches are post-placement only", () => {
    expect(isLegalTransition("in_guarantee", "termination")).toBe(true);
    expect(isLegalTransition("termination", "replacement")).toBe(true);
    expect(isLegalTransition("hired", "replacement")).toBe(false);
  });

  it("terminal sets agree with FR-038", () => {
    for (const s of [
      "rejected",
      "declined",
      "no_show",
      "discarded",
      "termination",
      "replacement",
    ] as CandidateStatus[]) {
      expect(NEGATIVE_TERMINAL_STATUSES.has(s)).toBe(true);
      expect(isNegativeTerminal(s)).toBe(true);
    }
    for (const s of [
      "hired",
      "in_guarantee",
      "guarantee_met",
    ] as CandidateStatus[]) {
      expect(POSITIVE_TERMINAL_STATUSES.has(s)).toBe(true);
      expect(isPositiveTerminal(s)).toBe(true);
    }
  });
});
