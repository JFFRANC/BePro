// 008-ux-roles-refinements / US4 — Spanish label coverage + statusLabel() helper.
import { describe, it, expect, vi } from "vitest";
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_STATUS_LABELS_ES,
  statusLabel,
  transitionOptionsFor,
  type CandidateStatus,
} from "../status.js";

describe("CANDIDATE_STATUS_LABELS_ES — presence (FR-LC-002)", () => {
  it("has a non-empty Spanish label for every enum value", () => {
    for (const s of CANDIDATE_STATUSES) {
      const label = CANDIDATE_STATUS_LABELS_ES[s];
      expect(label, `missing Spanish label for ${s}`).toBeDefined();
      expect(label).not.toBe("");
    }
  });

  it("keeps the English map stable for audit payloads", () => {
    for (const s of CANDIDATE_STATUSES) {
      expect(CANDIDATE_STATUS_LABELS[s]).toBeDefined();
    }
  });
});

describe("statusLabel() helper", () => {
  it("defaults to Spanish", () => {
    expect(statusLabel("registered")).toBe("Registrado");
    expect(statusLabel("interview_scheduled")).toBe("Entrevista programada");
    expect(statusLabel("hired")).toBe("Contratado");
  });

  it("returns English when lang='en'", () => {
    expect(statusLabel("registered", "en")).toBe("Registered");
    expect(statusLabel("hired", "en")).toBe("Hired");
  });

  it("warns and falls back to the raw token for unknown statuses", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const label = statusLabel("bogus" as CandidateStatus);
    expect(label).toBe("bogus");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Missing es label"),
    );
    warn.mockRestore();
  });
});

describe("transitionOptionsFor() — FSM + category grouping (US3)", () => {
  it("returns FSM-valid transitions only", () => {
    const opts = transitionOptionsFor("registered");
    const targets = opts.map((o) => o.nextStatus).sort();
    expect(targets).toEqual(["discarded", "interview_scheduled"]);
  });

  it("groups reject targets under the reject category", () => {
    const opts = transitionOptionsFor("interview_scheduled");
    const rejected = opts.find((o) => o.nextStatus === "rejected");
    expect(rejected?.category).toBe("reject");
    expect(rejected?.requiresCategory).toBe(true);
  });

  it("marks reactivate flow for termination → replacement", () => {
    const opts = transitionOptionsFor("termination");
    const replacement = opts.find((o) => o.nextStatus === "replacement");
    expect(replacement?.category).toBe("reactivate");
    expect(replacement?.requiresCategory).toBe(false);
  });

  it("decline targets carry requiresCategory=true", () => {
    const opts = transitionOptionsFor("approved");
    const declined = opts.find((o) => o.nextStatus === "declined");
    expect(declined?.category).toBe("decline");
    expect(declined?.requiresCategory).toBe(true);
  });

  it("ships a Spanish labelEs on every option", () => {
    const opts = transitionOptionsFor("approved");
    for (const o of opts) {
      expect(o.labelEs).toBeTruthy();
      expect(o.labelEs).toBe(CANDIDATE_STATUS_LABELS_ES[o.nextStatus]);
    }
  });
});
