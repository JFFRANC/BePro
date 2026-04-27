# Contract — Inline status transition (reuse of existing endpoint)

**Endpoint**: `POST /api/candidates/:candidateId/transitions` *(already shipped in 007)*
**Status**: no wire-level change. The inline menu is an additional caller.

## Authorization (unchanged, already enforced server-side)

| Role | Allowed transitions |
|---|---|
| `recruiter` | Only transitions listed as recruiter-authorized in the FSM map in `@bepro/shared/candidates/status.ts` |
| `account_executive` | AE-authorized transitions, on candidates within assigned clients |
| `manager` | All transitions on any tenant candidate |
| `admin` | All transitions + reactivation |

The UI MUST NOT hard-code role→transition mapping; it reads the same FSM/role table exported from `@bepro/shared` to render valid options.

## UI contract (web)

```ts
// apps/web/src/modules/candidates/hooks/useTransitionCandidate.ts
function useTransitionCandidate(): UseMutationResult<Candidate, ApiError, TransitionInput>;

interface TransitionInput {
  candidateId: string;
  nextStatus: CandidateStatus;
  categoryId?: string; // required when nextStatus ∈ { Rejected, Declined }
  reason?: string;
}
```

Behavior (see research.md R-02):
- `onMutate`: snapshot `CANDIDATE_KEYS.list(currentFilters)` and optimistically set the row's `status` + `statusChangedAt`.
- `onError`: rollback snapshot, emit `sonner` error toast with the server message.
- `onSettled`: `invalidate` list + detail queries.
- Special-case 409 `invalid_transition`: re-fetch the single candidate row and show "El estado cambió en otro lugar, intenta de nuevo."

## Dropdown option shape

```ts
type TransitionOption = {
  nextStatus: CandidateStatus;
  labelEs: string;            // from CANDIDATE_STATUS_LABELS_ES
  category: "advance" | "reject" | "decline" | "reactivate";
  requiresCategory: boolean;  // true for Rejected/Declined
};
```

Options MUST be grouped by `category` in the rendered menu, and MUST be filtered by:
1. FSM validity: `isValidTransition(current, next) === true`.
2. Role authorization: `canTransition(actorRole, current, next) === true`.

## Tests required

- Given a candidate in status X, the menu for each role renders exactly the transitions the server will accept — no more, no less (table-driven test across the FSM).
- Optimistic update paints the new status instantly; server error rolls back within the test's fake timers.
- 409 on stale transition triggers a single re-fetch and the Spanish error toast.
