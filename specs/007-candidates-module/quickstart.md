# Quickstart: Candidates Module

**Feature**: 007-candidates-module
**Audience**: engineers extending or consuming the candidates module. Module authors for other domains, skim §4 onward.

---

## 1. Register a candidate from the web app

```tsx
import { useCreateCandidate } from "@/modules/candidates/hooks/useCreateCandidate";

function NewCandidateForm({ clientId }: { clientId: string }) {
  const { mutate, isPending, duplicates, confirmDuplicates } =
    useCreateCandidate();

  const onSubmit = (values: NewCandidateFormValues) => {
    mutate({ ...values, client_id: clientId });
  };

  // duplicates is populated when the server responded 409 duplicates_detected.
  // Render the dialog; on confirm, re-submit with duplicate_confirmation.
  return (
    <>
      {/* form fields driven by client.form_config via buildDynamicSchema() */}
      <DuplicateWarningDialog
        open={duplicates.length > 0}
        duplicates={duplicates}
        onConfirm={confirmDuplicates}
      />
    </>
  );
}
```

Internal flow: the hook issues `POST /api/candidates`. If the server responds `409 duplicates_detected`, the hook parks the request in memory, exposes `duplicates[]` to the caller, and re-issues the POST with `duplicate_confirmation` when the user confirms.

---

## 2. List and filter candidates

```tsx
import { useCandidates } from "@/modules/candidates/hooks/useCandidates";

function CandidateList() {
  const { data, isLoading } = useCandidates({
    status: ["pending", "approved"],
    client_id: [selectedClientId],
    q: search,
  });
  // ...
}
```

Role-scoping happens server-side — the hook doesn't apply filters for role. Recruiters who open the list see only their own; AEs see only their assigned clients'; managers/admins see all.

---

## 3. Transition a candidate's status

```tsx
const { mutate } = useTransitionCandidate(candidateId);

mutate({
  from_status: candidate.status,      // MUST be the status on screen
  to_status: "approved",
  note: "Passed technical + cultural rounds",
});
```

For `rejected` or `declined`, the `RejectionCategoryPicker` (or decline-equivalent) is required; the mutation throws if the category id is missing.

On `409 stale_status`, the hook invalidates the candidate detail query so the UI refetches and shows the true current status. No retry loop.

---

## 4. Add a new PII-sensitive field

If you add a column to `candidates` that contains PII (CURP, RFC, a second phone, etc.):

1. Add the column to `packages/db/src/schema/candidates.ts` with a descriptive comment in Spanish.
2. Extend `packages/shared/src/candidates/schemas.ts` with Zod validation.
3. Update `apps/api/src/modules/candidates/redact.ts` — add the field name to the PII list.
4. Add a test case to `__tests__/redact.test.ts` confirming the field is stripped.
5. Write an entry in the relevant Edge Cases table in the spec if the field has a format invariant (e.g., CURP = 18 chars).

Skipping step 3 is a Constitution VI violation. The CI pipeline's log-scrub test would catch it, but don't rely on that — redact first.

---

## 5. Consume the audit events

Any module can read the `audit_events` table for candidate rows:

```ts
const events = await db
  .select()
  .from(auditEvents)
  .where(
    and(
      eq(auditEvents.tenantId, ctx.tenantId),
      eq(auditEvents.targetType, "candidate"),
      eq(auditEvents.targetId, candidateId),
    ),
  )
  .orderBy(desc(auditEvents.createdAt));
```

The shape is contractual (see `contracts/candidates-api.md` §13). When the future audit module ships, it takes ownership of this query; consumers do NOT need to change anything.

---

## 6. Add a new tenant in development

1. `pnpm db:push` to bring the schema up to date.
2. Insert the tenant via `scripts/seed-tenant.ts` (creates default rejection + decline categories, bootstrap admin user, default privacy notice v `YYYY-MM`).
3. Use the admin account to log in and walk through the US1 registration flow to verify.

---

## 7. Integration test harness (API)

Pattern used across `004-users-module` and now by candidates:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/test/db";
import { createApp } from "@/app";

describe("candidates routes — isolation", () => {
  const db = createTestDb();
  beforeEach(async () => {
    await db.seed.tenantA();
    await db.seed.tenantB();
  });

  it("tenant A cannot read tenant B candidates (RLS)", async () => {
    const app = createApp(db);
    const res = await app.request("/api/candidates", {
      headers: { authorization: `Bearer ${tokenForTenantA}` },
    });
    const body = await res.json();
    expect(body.items.every((c) => c.tenant_id === "tenant-a-id")).toBe(true);
  });
});
```

The `createTestDb` factory opens a dedicated Neon branch per test run; RLS is live.

---

## 8. Gotchas

- **Do NOT** query `candidates` without a `SET LOCAL app.tenant_id` in the enclosing transaction. RLS will filter to zero rows silently and look like a bug.
- **Do NOT** log `candidate.first_name + candidate.last_name`. Use `redact()` + `candidate.id`.
- **Do NOT** `DELETE` from any candidates-owned table. There is no delete policy — the query will return 0 rows deleted and you'll assume it worked.
- **Do NOT** trust client-sent `tenant_id`. It is ignored; the middleware injects the JWT-claimed tenant id.
- **Do NOT** validate `phone` via simple regex in one place and normalize in another. Always round-trip through `normalizePhone()`; store both raw and normalized.

---

## 9. Performance budgets to watch

| Endpoint | Budget | Notes |
|---|---|---|
| `GET /api/candidates` (paged) | p95 < 250 ms at 10 k | SC-002 |
| `POST /api/candidates` (no dup) | p95 < 500 ms | |
| `POST /api/candidates/:id/transitions` | p95 < 200 ms | audit write dominates |
| `GET /api/candidates?q=…` | p95 < 400 ms at 10 k | tsvector index |
| Duplicate probe `GET /api/candidates/duplicates` | p95 < 100 ms | single index hit |

Exceeding budget on any of these means an index is missing or a seq-scan crept in — run `EXPLAIN ANALYZE` before merging.
