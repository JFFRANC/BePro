// 008-ux-roles-refinements / US4 (T043 / T097) — QA sweep: zero English
// enum tokens should leak to end-user Spanish UI. This is a guard against
// future regressions that re-introduce the English label as the default.
import { describe, it, expect } from "vitest";
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_LABELS_ES,
  statusLabel,
  type CandidateStatus,
} from "@bepro/shared";

const ENGLISH_TOKENS_THAT_MUST_NOT_APPEAR_AS_UI_LABELS = [
  "Registered",
  "Interview Scheduled",
  "Attended",
  "Pending",
  "Approved",
  "Hired",
  "In Guarantee",
  "Guarantee Met",
  "Rejected",
  "Declined",
  "No Show",
  "Termination",
  "Discarded",
  "Replacement",
];

describe("Locale sweep — FR-LC-001 (no English enum tokens in Spanish UI)", () => {
  it("statusLabel defaults to Spanish for every enum value", () => {
    for (const s of CANDIDATE_STATUSES) {
      const ui = statusLabel(s);
      expect(ui).toBe(CANDIDATE_STATUS_LABELS_ES[s]);
      // And specifically, never the English version.
      expect(ui).not.toBe(CANDIDATE_STATUS_LABELS[s]);
    }
  });

  it("none of the Spanish labels accidentally equal their English counterparts", () => {
    for (const s of CANDIDATE_STATUSES) {
      expect(CANDIDATE_STATUS_LABELS_ES[s]).not.toBe(
        CANDIDATE_STATUS_LABELS[s],
      );
    }
  });

  it("the Spanish label map covers exactly the declared enum (no missing, no extras)", () => {
    const mapKeys = Object.keys(CANDIDATE_STATUS_LABELS_ES).sort();
    const enumValues = [...CANDIDATE_STATUSES].sort();
    expect(mapKeys).toEqual(enumValues);
  });

  it("unknown statuses fall through to the raw token (defensive)", () => {
    const label = statusLabel("nonexistent" as CandidateStatus);
    expect(label).toBe("nonexistent");
  });

  it("explicitly opting into English via lang='en' still works for audit payloads", () => {
    expect(statusLabel("hired", "en")).toBe("Hired");
    for (const token of ENGLISH_TOKENS_THAT_MUST_NOT_APPEAR_AS_UI_LABELS) {
      // Every English token is still reachable via lang='en' — the sweep is
      // only about the default path (which is Spanish).
      const match = CANDIDATE_STATUSES.find(
        (s) => CANDIDATE_STATUS_LABELS[s] === token,
      );
      expect(match, `English token "${token}" missing from enum`).toBeDefined();
    }
  });
});
