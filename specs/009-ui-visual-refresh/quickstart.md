# Quickstart: UI/UX Visual Refresh

**Feature**: 009-ui-visual-refresh
**Audience**: reviewers, integrators, and the developer running the final audit before merge.

## Prerequisites

- Checked out branch `009-ui-visual-refresh` (or running from the isolated worktree at `.worktrees/ui-ux-refresh/`)
- Node + pnpm installed; monorepo deps installed (`pnpm install`)
- Local Neon proxy or seeded dev DB (standard BePro dev setup)

## 1. Run the automated guardrails

From repo root (or the worktree root):

```bash
pnpm -F @bepro/web test          # Vitest — includes contrast audit + bundle guard
pnpm -F @bepro/web lint
pnpm -F @bepro/web typecheck     # or `tsc --noEmit` if not yet scripted
```

**Pass criteria**:

- `contrast.audit.test.ts` passes (every documented token pair meets WCAG AA in both modes).
- `bundle-size.guard.test.ts` passes (dist bundle ≤ baseline × 1.05 → satisfies SC-005).
- All component unit tests pass (includes reduced-motion assertions).

## 2. Start the dev server

```bash
pnpm -F @bepro/web dev
```

The other Claude instance may already be running a dev server on 5173 in the main worktree. If so, start this one on a different port:

```bash
pnpm -F @bepro/web dev --port 5174
```

## 3. Manual screen-by-screen audit

Walk every listed screen in **both light and dark mode**. Use the header theme toggle (feature 006) to switch.

| # | Screen | Light ✓ | Dark ✓ | Empty state ✓ | Loading state ✓ | Error state ✓ |
|---|---|---|---|---|---|---|
| 1 | Login | ☐ | ☐ | — | — | ☐ (bad credentials) |
| 2 | Change password | ☐ | ☐ | — | — | ☐ (validation) |
| 3 | Dashboard (per role) | ☐ | ☐ | ☐ (no data) | ☐ (initial fetch) | ☐ (fetch fail) |
| 4 | Candidates — list | ☐ | ☐ | ☐ | ☐ | ☐ |
| 5 | Candidates — detail | ☐ | ☐ | — | ☐ | ☐ |
| 6 | Candidates — register | ☐ | ☐ | — | — | ☐ (validation + duplicate warning) |
| 7 | Clients — list | ☐ | ☐ | ☐ | ☐ | ☐ |
| 8 | Clients — detail | ☐ | ☐ | — | ☐ | ☐ |
| 9 | Placements — list | ☐ | ☐ | ☐ | ☐ | ☐ |
| 10 | Placements — detail | ☐ | ☐ | — | ☐ | ☐ |
| 11 | Users admin | ☐ | ☐ | ☐ | ☐ | ☐ |
| 12 | Audit log | ☐ | ☐ | ☐ | ☐ | ☐ |
| 13 | Settings | ☐ | ☐ | — | — | — |
| 14 | Shell (sidebar, topbar, breadcrumb, command palette, toasts) | ☐ | ☐ | — | — | — |

For each row, confirm:

- New blueish palette is applied (no residual legacy colors).
- Cards, buttons, inputs, badges, tables match the modernized language (restrained radius, intentional shadows, consistent spacing).
- Motion feels subtle (≤ 250ms for hover/press) and tasteful.
- Focus rings are visible on keyboard navigation.
- Empty, loading, and error states are present and on-brand where applicable.

## 4. Reduced-motion verification

Enable reduced motion at the OS level:

- **macOS**: System Settings → Accessibility → Display → Reduce motion = ON
- **Windows**: Settings → Accessibility → Visual effects → Animation effects = OFF
- **Linux (GNOME)**: Settings → Accessibility → Reduce animation = ON

Re-walk a sample of screens (dashboard, candidates list, any dialog, any sheet) and confirm:

- Dialogs and sheets open with opacity only (no slide).
- Cards and buttons do not scale/translate on hover.
- Skeleton pulses are disabled (static placeholders).
- Page transitions fade only.
- No functionality is lost.

## 5. Localization spot check

Switch the app to Spanish (existing locale). Re-check the dashboard, candidates list, and any form-heavy screen. Confirm:

- No layout overflow or truncation under the longer Spanish labels.
- Typography scale stays consistent.
- All buttons / badges / labels remain readable.

## 6. Bundle and performance spot check

```bash
pnpm -F @bepro/web build
```

- Note the printed `dist/` asset sizes.
- Compare against the baseline recorded in `bundle-size.guard.test.ts`. Must be within +5%.
- Optional: run Lighthouse in Chrome DevTools on `dashboard` and `candidates` list. Score delta vs pre-refresh baseline must be within -5 points (SC-006).

## 7. Merge preparation

Before opening the PR to `development`:

1. Run `pnpm -F @bepro/web test && pnpm -F @bepro/web lint && pnpm -F @bepro/web typecheck` one last time.
2. Confirm every row in the audit table (step 3) is checked.
3. Confirm reduced-motion verification (step 4) passed.
4. If branch `008-ux-roles-refinements` merged first: `git fetch origin && git rebase origin/development` and re-run steps 1–3.
5. Push the branch and open the PR. Reference this spec (009) and link to `spec.md`.

## 8. Rollback plan

Because the refresh is token-driven, rollback is a revert of the `apps/web/src/index.css` token block plus the component-file commits. No data migration is required. Feature flags are NOT necessary: the refresh is low-risk and purely visual.
