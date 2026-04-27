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
    const initial: IClientAssignmentDto[] = [
      mkAssignment(AE1, "account_executive"),
      mkAssignment(REC1, "recruiter", AE1),
    ];
    const { result } = renderHook(() => useAssignmentsState(initial));
    expect(result.current.assignedAEs.has(AE1)).toBe(true);
    expect(result.current.recruiters.get(REC1)).toBe(AE1);
    expect(result.current.isDirty).toBe(false);
  });

  it("stageAE flips isDirty and appears in batch payload", () => {
    const initial: IClientAssignmentDto[] = [];
    const { result } = renderHook(() => useAssignmentsState(initial));
    act(() => result.current.stageAE(AE1));
    expect(result.current.isDirty).toBe(true);
    expect(result.current.toBatchPayload().accountExecutives).toContain(AE1);
  });

  it("stageRecruiter without leader serializes without accountExecutiveId key", () => {
    const initial: IClientAssignmentDto[] = [];
    const { result } = renderHook(() => useAssignmentsState(initial));
    act(() => result.current.stageRecruiter(REC1));
    const payload = result.current.toBatchPayload();
    expect(payload.recruiters).toEqual([{ userId: REC1 }]);
  });

  it("stageRecruiter with setLeader serializes accountExecutiveId", () => {
    const initial: IClientAssignmentDto[] = [];
    const { result } = renderHook(() => useAssignmentsState(initial));
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
    const initial: IClientAssignmentDto[] = [
      mkAssignment(AE1, "account_executive"),
      mkAssignment(REC1, "recruiter", AE1),
    ];
    const { result } = renderHook(() => useAssignmentsState(initial));
    let outcome: { orphanedRecruiters: string[] } = { orphanedRecruiters: [] };
    act(() => {
      outcome = result.current.unstage(AE1);
    });
    expect(outcome.orphanedRecruiters).toEqual([REC1]);
    expect(result.current.assignedAEs.has(AE1)).toBe(false);
    expect(result.current.recruiters.get(REC1)).toBe(null);
  });

  it("reset reverts all staged changes to the pristine server state", () => {
    const initial: IClientAssignmentDto[] = [
      mkAssignment(AE1, "account_executive"),
    ];
    const { result } = renderHook(() => useAssignmentsState(initial));
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
    const initial: IClientAssignmentDto[] = [
      mkAssignment(AE1, "account_executive"),
      mkAssignment(REC1, "recruiter", AE1),
    ];
    const { result } = renderHook(() => useAssignmentsState(initial));
    act(() => result.current.setLeader(REC1, AE1));
    expect(result.current.isDirty).toBe(false);
  });

  // Regression: hook MUST tolerate parents that re-create the assignments
  // array on every render without infinite re-render loops, and MUST preserve
  // local edits across content-equivalent re-renders.
  it("does not infinite-loop when a fresh array ref with identical content is passed", () => {
    const { result, rerender } = renderHook(
      ({ data }: { data: IClientAssignmentDto[] }) =>
        useAssignmentsState(data),
      {
        initialProps: {
          data: [mkAssignment(AE1, "account_executive")],
        },
      },
    );
    rerender({ data: [mkAssignment(AE1, "account_executive")] });
    expect(result.current.assignedAEs.has(AE1)).toBe(true);
    act(() => result.current.stageRecruiter(REC1));
    rerender({ data: [mkAssignment(AE1, "account_executive")] });
    expect(result.current.recruiters.has(REC1)).toBe(true);
  });

  it("re-seeds when server-side content actually changes", () => {
    const { result, rerender } = renderHook(
      ({ data }: { data: IClientAssignmentDto[] }) =>
        useAssignmentsState(data),
      {
        initialProps: {
          data: [mkAssignment(AE1, "account_executive")],
        },
      },
    );
    expect(result.current.assignedAEs.has(AE1)).toBe(true);
    expect(result.current.assignedAEs.has(AE2)).toBe(false);
    rerender({
      data: [
        mkAssignment(AE1, "account_executive"),
        mkAssignment(AE2, "account_executive"),
      ],
    });
    expect(result.current.assignedAEs.has(AE2)).toBe(true);
  });
});
