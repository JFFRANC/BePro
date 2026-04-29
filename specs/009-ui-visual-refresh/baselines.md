# Baselines for feature 009-ui-visual-refresh

Captured before any refresh code lands. Used to anchor:
- SC-004 (no new a11y violations)
- SC-005 (bundle ≤ baseline × 1.05)
- SC-006 (Lighthouse delta ≤ -5pt)

---

## T001 — Baseline test suite + lint + typecheck (2026-04-23)

| Check | Command | Result |
|---|---|---|
| Tests | `pnpm -F @bepro/web test` | **52 files, 252 tests, 0 failing** |
| Lint | `pnpm -F @bepro/web lint` | **OK** (echo stub — see CLAUDE.md note) |
| Typecheck | `pnpm -F @bepro/web typecheck` (`tsc --noEmit`) | **0 errors** |

**Pre-run setup required**: `pnpm -F @bepro/shared build` once in a fresh worktree, so Vite can resolve `@bepro/shared` imports. (Noted here for any future contributor hitting the same symptom on a clean checkout.)

---

## T002 — Baseline production bundle (to be populated by `bundle-baseline.json`)

Build command: `pnpm -F @bepro/web build`. Output captured in:
- `apps/web/src/__tests__/__fixtures__/bundle-baseline.json` — per-file + total gzipped sizes from this run's `dist/assets/*`.

Guardrail: SC-005 — post-refresh total gzipped size MUST be ≤ baseline × 1.05.

---

## T003 — Baseline Lighthouse scores (manual step)

Run Lighthouse (Chrome DevTools → Lighthouse panel, or `npx lighthouse` CLI) against the dev server at:
- `/login`
- `/dashboard`
- `/candidates`

Record Performance and Accessibility scores below. Guardrail: SC-006 — post-refresh scores MUST be within -5 pts of baseline on both `/dashboard` and `/candidates`.

| Page | Perf | A11y | Run date | Notes |
|---|---|---|---|---|
| `/login` | — | — | — | Pending |
| `/dashboard` | — | — | — | Pending |
| `/candidates` | — | — | — | Pending |

**Note**: Lighthouse on the dev server is a rough baseline; a production-build preview (`pnpm -F @bepro/web preview`) gives the real baseline. For now the dev-server numbers are acceptable per the spec's Assumptions section ("Manual visual audit is acceptable").

---

## T082 — Post-refresh Lighthouse re-measure (placeholder — Phase 7)

Will be filled at T082.

## T101 — Post-refresh axe-core audit (placeholder — Phase 7)

Will be filled at T101.
