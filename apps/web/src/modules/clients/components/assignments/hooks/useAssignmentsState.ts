// Local staged state for the Asignaciones tab. Seeds from the server-side
// assignment list (split by role) and exposes a desired-state payload for the
// batch endpoint.
import { useEffect, useMemo, useState } from "react";
import type { IClientAssignmentDto } from "@bepro/shared";
import type { IBatchAssignmentsRequest } from "../../../services/clientService";

export interface StagedRecruiter {
  userId: string;
  accountExecutiveId: string | null;
}

export interface AssignmentsSnapshot {
  aes: Set<string>;
  recruiters: Map<string, string | null>;
}

function snapshotFromAssignments(
  assignments: IClientAssignmentDto[] | undefined,
): AssignmentsSnapshot {
  const aes = new Set<string>();
  const recruiters = new Map<string, string | null>();
  for (const a of assignments ?? []) {
    if (a.userRole === "account_executive") {
      aes.add(a.userId);
    } else if (a.userRole === "recruiter") {
      recruiters.set(a.userId, a.accountExecutiveId ?? null);
    }
  }
  return { aes, recruiters };
}

function snapshotsEqual(a: AssignmentsSnapshot, b: AssignmentsSnapshot) {
  if (a.aes.size !== b.aes.size) return false;
  for (const id of a.aes) if (!b.aes.has(id)) return false;
  if (a.recruiters.size !== b.recruiters.size) return false;
  for (const [id, leader] of a.recruiters) {
    if (!b.recruiters.has(id)) return false;
    if (b.recruiters.get(id) !== leader) return false;
  }
  return true;
}

function cloneSnapshot(s: AssignmentsSnapshot): AssignmentsSnapshot {
  return {
    aes: new Set(s.aes),
    recruiters: new Map(s.recruiters),
  };
}

export interface UseAssignmentsStateReturn {
  assignedAEs: Set<string>;
  recruiters: Map<string, string | null>;
  pristine: AssignmentsSnapshot;
  isDirty: boolean;
  stageAE: (userId: string) => void;
  stageRecruiter: (userId: string, leaderId?: string | null) => void;
  unstage: (userId: string) => { orphanedRecruiters: string[] };
  setLeader: (recruiterId: string, leaderId: string | null) => void;
  reset: () => void;
  toBatchPayload: () => IBatchAssignmentsRequest;
}

export function useAssignmentsState(
  assignments: IClientAssignmentDto[] | undefined,
): UseAssignmentsStateReturn {
  const pristine = useMemo(
    () => snapshotFromAssignments(assignments),
    [assignments],
  );

  const [staged, setStaged] = useState<AssignmentsSnapshot>(() =>
    cloneSnapshot(pristine),
  );

  // Re-seed local state whenever the server-side snapshot identity changes.
  useEffect(() => {
    setStaged(cloneSnapshot(pristine));
  }, [pristine]);

  const stageAE = (userId: string) => {
    setStaged((s) => {
      if (s.aes.has(userId)) return s;
      const aes = new Set(s.aes);
      aes.add(userId);
      // Staging a userId as AE auto-removes it from recruiters (shouldn't
      // happen normally — Zod also rejects cross-list — but keep state sane).
      const recruiters = new Map(s.recruiters);
      recruiters.delete(userId);
      return { aes, recruiters };
    });
  };

  const stageRecruiter = (
    userId: string,
    leaderId: string | null = null,
  ) => {
    setStaged((s) => {
      if (s.recruiters.has(userId)) return s;
      const recruiters = new Map(s.recruiters);
      recruiters.set(userId, leaderId);
      const aes = new Set(s.aes);
      aes.delete(userId);
      return { aes, recruiters };
    });
  };

  const setLeader = (recruiterId: string, leaderId: string | null) => {
    setStaged((s) => {
      if (!s.recruiters.has(recruiterId)) return s;
      const recruiters = new Map(s.recruiters);
      recruiters.set(recruiterId, leaderId);
      return { aes: s.aes, recruiters };
    });
  };

  const unstage = (userId: string): { orphanedRecruiters: string[] } => {
    let orphanedRecruiters: string[] = [];
    setStaged((s) => {
      if (s.aes.has(userId)) {
        const aes = new Set(s.aes);
        aes.delete(userId);
        const recruiters = new Map(s.recruiters);
        // Any staged recruiter whose leader was this AE must have its leader
        // nulled; report those to the caller so it can confirm the cascade.
        for (const [recId, leaderId] of recruiters) {
          if (leaderId === userId) {
            recruiters.set(recId, null);
            orphanedRecruiters.push(recId);
          }
        }
        return { aes, recruiters };
      }
      if (s.recruiters.has(userId)) {
        const recruiters = new Map(s.recruiters);
        recruiters.delete(userId);
        return { aes: s.aes, recruiters };
      }
      return s;
    });
    return { orphanedRecruiters };
  };

  const reset = () => setStaged(cloneSnapshot(pristine));

  const toBatchPayload = (): IBatchAssignmentsRequest => ({
    accountExecutives: Array.from(staged.aes).sort(),
    recruiters: Array.from(staged.recruiters)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([userId, leaderId]) =>
        leaderId ? { userId, accountExecutiveId: leaderId } : { userId },
      ),
  });

  return {
    assignedAEs: staged.aes,
    recruiters: staged.recruiters,
    pristine,
    isDirty: !snapshotsEqual(staged, pristine),
    stageAE,
    stageRecruiter,
    unstage,
    setLeader,
    reset,
    toBatchPayload,
  };
}
