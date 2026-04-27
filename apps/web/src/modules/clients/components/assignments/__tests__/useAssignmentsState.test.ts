import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAssignmentsState } from "../hooks/useAssignmentsState";
import type { IClientAssignmentDto } from "@bepro/shared";

const AE1 = "ae-1";
const AE2 = "ae-2";
const REC1 = "rec-1";
const REC2 = "rec-2";

function mkAssignment(
  userId: string,
  userRole: "account_executive" | "recruiter",
  accountExecutiveId?: string,
): IClientAssignmentDto {
  return {
    id: `a-${userId}`,
    clientId: "c-1",
    clientName: "Client",
    userId,
    userFullName: userId,
    userRole,
    accountExecutiveId,
  };
}

describe("useAssignmentsState", () => {
  it("seeds pristine from server assignments split by role", () => {
    const { result } = renderHook(() =>
      useAssignmentsState([
        mkAssignment(AE1, "account_executive"),
        mkAssignment(REC1, "recruiter", AE1),
      ]),
    );
    expect(result.current.assignedAEs.has(AE1)).toBe(true);
    expect(result.current.recruiters.get(REC1)).toBe(AE1);
    expect(result.current.isDirty).toBe(false);
  });

  it("stageAE flips isDirty and appears in batch payload", () => {
    const { result } = renderHook(() => useAssignmentsState([]));
    act(() => result.current.stageAE(AE1));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.toBatchPayload().accountExecutives).toContain(AE1);
  });

  it("stageRecruiter without leader serializes without accountExecutiveId key", () => {
    const { result } = renderHook(() => useAssignmentsState([]));
    act(() => result.current.stageRecruiter(REC1));
    const payload = result.current.toBatchPayload();
    expect(payload.recruiters).toEqual([{ userId: REC1 }]);
  });

  it("stageRecruiter with setLeader serializes accountExecutiveId", () => {
    const { result } = renderHook(() => useAssignmentsState([]));
    act(() => {
      result.current.stageAE(AE1);
      result.current.stageRecruiter(REC1);
      result.current.setLeader(REC1, AE1);
    });
    const payload = result.current.toBatchPayload();
    expect(payload.recruiters).toEqual([
      { userId: REC1, accountExecutiveId: AE1 },
    ]);
  });

  it("unstage AE reports orphaned recruiters and nulls their leader locally", () => {
    const { result } = renderHook(() =>
      useAssignmentsState([
        mkAssignment(AE1, "account_executive"),
        mkAssignment(REC1, "recruiter", AE1),
      ]),
    );
    let outcome: { orphanedRecruiters: string[] } = { orphanedRecruiters: [] };
    act(() => {
      outcome = result.current.unstage(AE1);
    });
    expect(outcome.orphanedRecruiters).toEqual([REC1]);
    expect(result.current.assignedAEs.has(AE1)).toBe(false);
    expect(result.current.recruiters.get(REC1)).toBe(null);
  });

  it("reset reverts all staged changes to the pristine server state", () => {
    const { result } = renderHook(() =>
      useAssignmentsState([mkAssignment(AE1, "account_executive")]),
    );
    act(() => {
      result.current.stageAE(AE2);
      result.current.stageRecruiter(REC2, AE1);
    });
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.isDirty).toBe(false);
    expect(result.current.assignedAEs.has(AE2)).toBe(false);
    expect(result.current.recruiters.has(REC2)).toBe(false);
  });

  it("idempotent: re-setting leader to same value keeps isDirty false relative to pristine", () => {
    const { result } = renderHook(() =>
      useAssignmentsState([
        mkAssignment(AE1, "account_executive"),
        mkAssignment(REC1, "recruiter", AE1),
      ]),
    );
    act(() => result.current.setLeader(REC1, AE1));
    expect(result.current.isDirty).toBe(false);
  });
});
