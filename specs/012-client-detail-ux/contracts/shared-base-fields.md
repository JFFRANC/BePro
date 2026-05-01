# Contract — `@bepro/shared` exports for BASE_CANDIDATE_FIELDS

**Module**: `packages/shared/src/candidates/`
**Feature**: 012 / FR-009
**File**: `packages/shared/src/candidates/base-fields.ts` (new)

---

## Public exports

```ts
export type BaseFieldType = "text" | "date" | "select";

export interface BaseFieldDef {
  key: string;
  label: string;       // Spanish display label
  type: BaseFieldType;
  required: true;      // base fields are always required
}

/**
 * The nine base fields every candidate registration form MUST contain.
 * Order matters — this is the visual order used by the Formulario tab UI.
 *
 * Stored values live in candidates.additional_fields JSONB.
 * Modifying this array is a constitution-level change (see spec 012 / Out of Scope).
 */
export const BASE_CANDIDATE_FIELDS: ReadonlyArray<BaseFieldDef>;

export type BaseFieldKey = typeof BASE_CANDIDATE_FIELDS[number]["key"];
//   = "fullName" | "interviewPhone" | "interviewDate" | "interviewTime"
//   | "positionId" | "state" | "municipality" | "recruiterName" | "accountExecutiveName"

export const BASE_FIELD_KEY_SET: ReadonlySet<BaseFieldKey>;
```

The constant is `as const` + `Object.freeze`d at module load to make accidental mutation a runtime error.

---

## Re-export

```ts
// packages/shared/src/candidates/index.ts
export * from "./base-fields";
export * from "./form-config";
export * from "./schemas";
export * from "./status";
```

```ts
// packages/shared/src/index.ts
export * from "./candidates";
// ... existing re-exports
```

---

## Contract guarantees

1. `BASE_CANDIDATE_FIELDS.length === 9`
2. `BASE_CANDIDATE_FIELDS[i].key` keys are unique (no duplicates).
3. Order is exactly: `["fullName","interviewPhone","interviewDate","interviewTime","positionId","state","municipality","recruiterName","accountExecutiveName"]`.
4. Every entry has a non-empty Spanish `label`.
5. `BASE_FIELD_KEY_SET.size === 9` and equals `new Set(BASE_CANDIDATE_FIELDS.map(f => f.key))`.
6. `Object.isFrozen(BASE_CANDIDATE_FIELDS) === true`.
7. The constant is consumed by:
   - `apps/web/src/modules/clients/components/FormConfigFieldsEditor.tsx` (renders locked rows)
   - `apps/web/src/modules/candidates/components/RegisterCandidateForm.tsx` (renders the form's leading rows)
   - `apps/api/src/modules/candidates/service.ts` (`assertEffectiveFormConfigContainsBase`, dynamic schema build)
   - `packages/shared/src/clients/schemas.ts` (`fieldKeySchema` collision refine)
   - `scripts/012-rename-legacy-formconfig-collisions.ts` (collision detection)

---

## Test matrix (`packages/shared/src/candidates/__tests__/base-fields.test.ts`)

| Test | Expectation |
|---|---|
| `BASE_CANDIDATE_FIELDS.length === 9` | passes |
| Keys match exact ordered list | passes |
| All entries `required: true` | passes |
| `Object.isFrozen(BASE_CANDIDATE_FIELDS)` | true |
| Mutation attempt throws (strict mode) | `BASE_CANDIDATE_FIELDS.push(...)` throws TypeError |
| `BASE_FIELD_KEY_SET.has("fullName")` | true |
| `BASE_FIELD_KEY_SET.has("foo")` | false |
| `BASE_FIELD_KEY_SET.size === 9` | passes |
| Spanish labels non-empty | every label `.length > 0` |
| `positionId` is the only `select` type | type filter passes |
| `interviewDate` is the only `date` type | type filter passes |

---

## Build cycle reminder (per `packages/shared/CLAUDE.md`)

After editing `base-fields.ts`, run:

```bash
pnpm --filter @bepro/shared build
```

Otherwise `apps/api` and `apps/web` continue importing the stale `dist/`. The repository's `pnpm typecheck` script handles this automatically as part of its dependency chain.
