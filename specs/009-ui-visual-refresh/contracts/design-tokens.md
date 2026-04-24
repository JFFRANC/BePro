# Contract: Design Tokens

**Feature**: 009-ui-visual-refresh
**Phase**: 1 (Design & Contracts)
**Consumers**: every shadcn primitive (`apps/web/src/components/ui/*`), every first-party wrapper (`apps/web/src/components/*`), every module screen (login, dashboard, candidates, clients, users, placements, audit, settings)

## Purpose

The canonical list of CSS-variable design tokens exposed by `apps/web/src/index.css`. Every consumer reads tokens via Tailwind utilities (`bg-primary`, `text-foreground`, `border-border`, `ring-ring`, etc.) — never via hard-coded hex values. Modifying a token here propagates to every consumer automatically.

Tokens are expressed in `oklch(L C H)` (Tailwind 4.x native color space) so contrast math is perceptually uniform across light and dark modes.

## Exposed tokens

### Core surface + text

| Token | Light (`:root`) | Dark (`.dark`) | Used for | Contrast pair |
|---|---|---|---|---|
| `--background` | `oklch(0.99 0.003 240)` | `oklch(0.14 0.015 240)` | Page / app background | — (pair below) |
| `--foreground` | `oklch(0.18 0.015 240)` | `oklch(0.96 0.005 240)` | Primary text on `--background` | ≥ 4.5 : 1 vs `--background` |
| `--card` | `oklch(1.00 0.000 0)` | `oklch(0.17 0.015 240)` | Card / surface background | — |
| `--card-foreground` | Same as `--foreground` | Same as `--foreground` | Text on `--card` | ≥ 4.5 : 1 vs `--card` |
| `--popover` | `oklch(1.00 0.000 0)` | `oklch(0.18 0.015 240)` | Popover / dropdown / dialog surface | — |
| `--popover-foreground` | Same as `--foreground` | Same as `--foreground` | Text on `--popover` | ≥ 4.5 : 1 vs `--popover` |
| `--muted` | `oklch(0.96 0.008 235)` | `oklch(0.22 0.015 240)` | Muted / subtle surfaces | — |
| `--muted-foreground` | `oklch(0.46 0.015 235)` | `oklch(0.68 0.015 235)` | Secondary text | ≥ 4.5 : 1 vs `--muted`, ≥ 4.5 : 1 vs `--background` |

### Brand + interaction

| Token | Light | Dark | Used for | Contrast pair |
|---|---|---|---|---|
| `--primary` | `oklch(0.55 0.16 225)` | `oklch(0.68 0.14 225)` | Primary action, active nav, links, focus accents | `--primary-foreground` ≥ 4.5 : 1 |
| `--primary-foreground` | `oklch(0.99 0.000 0)` | `oklch(0.15 0.015 240)` | Text on `--primary` | ≥ 4.5 : 1 vs `--primary` |
| `--secondary` | `oklch(0.94 0.010 230)` | `oklch(0.24 0.015 235)` | Secondary buttons, subtle surfaces | — |
| `--secondary-foreground` | Same as `--foreground` | Same as `--foreground` | Text on `--secondary` | ≥ 4.5 : 1 vs `--secondary` |
| `--accent` | `oklch(0.94 0.020 225)` | `oklch(0.26 0.030 225)` | Hover surface, keyboard focus bg | — |
| `--accent-foreground` | Same as `--foreground` | Same as `--foreground` | Text on `--accent` | ≥ 4.5 : 1 vs `--accent` |
| `--ring` | `oklch(0.55 0.16 225)` | `oklch(0.70 0.14 225)` | Keyboard-focus outline | ≥ 3 : 1 vs adjacent bg (non-text) |
| `--border` | `oklch(0.90 0.005 235)` | `oklch(0.28 0.015 235)` | Default border | — (decorative) |
| `--input` | `oklch(0.92 0.005 235)` | `oklch(0.30 0.015 235)` | Form input border / divider | — |

### Semantic

| Token | Light | Dark | Used for | Contrast pair |
|---|---|---|---|---|
| `--destructive` | `oklch(0.56 0.19 25)` | `oklch(0.65 0.19 25)` | Destructive action (delete, reject) | `--destructive-foreground` ≥ 4.5 : 1 |
| `--destructive-foreground` | `oklch(0.99 0.000 0)` | `oklch(0.98 0.005 25)` | Text on `--destructive` | ≥ 4.5 : 1 vs `--destructive` |
| `--success` | `oklch(0.58 0.14 155)` | `oklch(0.70 0.14 155)` | Success badge, confirmed states | ≥ 4.5 : 1 vs `--success-foreground` |
| `--success-foreground` | `oklch(0.99 0.000 0)` | `oklch(0.15 0.020 155)` | Text on `--success` | — |
| `--warning` | `oklch(0.72 0.16 80)` | `oklch(0.80 0.14 80)` | Warning state (guarantees, expirations) | ≥ 4.5 : 1 vs `--warning-foreground` |
| `--warning-foreground` | `oklch(0.20 0.020 80)` | `oklch(0.15 0.020 80)` | Text on `--warning` | — |
| `--info` | `oklch(0.60 0.13 235)` | `oklch(0.72 0.12 235)` | Informational surface | ≥ 4.5 : 1 vs `--info-foreground` |
| `--info-foreground` | `oklch(0.99 0.000 0)` | `oklch(0.15 0.015 235)` | Text on `--info` | — |

### Sidebar (owned by feature 005, updated here)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--sidebar` | `oklch(0.97 0.005 235)` | `oklch(0.15 0.012 240)` | Sidebar background |
| `--sidebar-foreground` | Same as `--foreground` | Same as `--foreground` | Sidebar text |
| `--sidebar-primary` | Same as `--primary` | Same as `--primary` | Active nav item bg |
| `--sidebar-primary-foreground` | Same as `--primary-foreground` | Same as `--primary-foreground` | Active nav item text |
| `--sidebar-accent` | Same as `--accent` | Same as `--accent` | Hover nav item bg |
| `--sidebar-accent-foreground` | Same as `--accent-foreground` | Same as `--accent-foreground` | Hover nav item text |
| `--sidebar-border` | Same as `--border` | Same as `--border` | Sidebar divider |
| `--sidebar-ring` | Same as `--ring` | Same as `--ring` | Nav focus outline |

### Charts (consumed by stat-card / dashboards)

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--chart-1` | `oklch(0.60 0.14 225)` | `oklch(0.70 0.14 225)` | Primary series (blue) |
| `--chart-2` | `oklch(0.62 0.12 195)` | `oklch(0.72 0.12 195)` | Secondary series (teal) |
| `--chart-3` | `oklch(0.65 0.12 265)` | `oklch(0.72 0.12 265)` | Tertiary series (indigo) |
| `--chart-4` | `oklch(0.70 0.14 80)` | `oklch(0.78 0.14 80)` | Warning / accent series |
| `--chart-5` | `oklch(0.58 0.14 155)` | `oklch(0.72 0.14 155)` | Positive series |

### Radius scale (non-color tokens)

| Token | Value | Used for |
|---|---|---|
| `--radius-xs` | `2px` | Inline chips / small badges |
| `--radius-sm` | `4px` | Inputs, small surfaces |
| `--radius-md` | `6px` | **Default** for cards, buttons, dialogs |
| `--radius-lg` | `8px` | Elevated surfaces, prominent cards |
| `--radius-xl` | `12px` | Modals, sheets (top corners), hero sections |
| `--radius-full` | `9999px` | Chips, avatars, status dots, pill progress — NOT buttons, NOT cards |

### Shadow scale (non-color tokens)

| Token | Value (light) | Value (dark) | Used for |
|---|---|---|---|
| `--shadow-sm` | `0 1px 2px oklch(0 0 0 / 0.04)` | `0 1px 2px oklch(0 0 0 / 0.30)` | Subtle separation |
| `--shadow-md` | `0 2px 4px oklch(0 0 0 / 0.06), 0 4px 8px oklch(0 0 0 / 0.04)` | `0 2px 4px oklch(0 0 0 / 0.35), 0 4px 8px oklch(0 0 0 / 0.25)` | Cards, dropdowns |
| `--shadow-lg` | `0 4px 8px oklch(0 0 0 / 0.08), 0 12px 24px oklch(0 0 0 / 0.06)` | `0 4px 8px oklch(0 0 0 / 0.40), 0 12px 24px oklch(0 0 0 / 0.30)` | Dialogs, sheets, popovers |

### Typography tokens (FR-009)

Font-family tokens:

| Token | Value | Used for |
|---|---|---|
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | Default UI text |
| `--font-display` | `"Inter", ui-sans-serif, system-ui, sans-serif` (tighter tracking via letter-spacing token) | Display / h1 / h2 |
| `--font-mono` | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace` | Code, tabular numerals in stat-cards |

Type scale — each step defines font-size + line-height + letter-spacing + weight:

| Token (size) | Token (line-height) | Token (letter-spacing) | Token (weight) | Px size / line-height | Used for |
|---|---|---|---|---|---|
| `--text-display` | `--leading-display` | `--tracking-display` | `--font-weight-bold` | `clamp(2.25rem, 2rem + 1.2vw, 3rem)` / `1.1` | Hero headings, login title |
| `--text-h1` | `--leading-h1` | `--tracking-tight` | `--font-weight-semibold` | `1.75rem` (28px) / `2.25rem` (36px) | Page titles |
| `--text-h2` | `--leading-h2` | `--tracking-tight` | `--font-weight-semibold` | `1.375rem` (22px) / `1.875rem` (30px) | Section titles |
| `--text-h3` | `--leading-h3` | `--tracking-normal` | `--font-weight-semibold` | `1.125rem` (18px) / `1.625rem` (26px) | Subsection titles, card titles |
| `--text-body` | `--leading-body` | `--tracking-normal` | `--font-weight-regular` | `0.875rem` (14px) / `1.375rem` (22px) | Default body text, table rows, labels |
| `--text-body-lg` | `--leading-body-lg` | `--tracking-normal` | `--font-weight-regular` | `1rem` (16px) / `1.5rem` (24px) | Lead paragraphs, stat-card support |
| `--text-caption` | `--leading-caption` | `--tracking-wide` | `--font-weight-medium` | `0.75rem` (12px) / `1.125rem` (18px) | Badges, captions, muted meta |
| `--text-code` | `--leading-body` | `--tracking-normal` | `--font-weight-regular` | `0.8125rem` (13px) / `1.375rem` (22px) | Inline code, tabular numerals |

Letter-spacing tokens:

| Token | Value | Used for |
|---|---|---|
| `--tracking-display` | `-0.02em` | Display, h1, h2 (tightened for large sizes) |
| `--tracking-tight` | `-0.01em` | h1, h2 |
| `--tracking-normal` | `0` | Default body |
| `--tracking-wide` | `0.025em` | Caption, ALL-CAPS labels |

Font-weight tokens:

| Token | Value |
|---|---|
| `--font-weight-regular` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |
| `--font-weight-bold` | `700` |

### Typography consumption rule

Consumers MUST reference Tailwind utilities that resolve to these tokens (e.g., `text-body`, `leading-body`, `tracking-tight`, `font-semibold`) exposed via `@theme inline` — never ad-hoc `text-[14px]` arbitrary values. This prevents drift and lets a future typography adjustment (e.g., swapping Inter for Geist) propagate via a single file.

## Stability contract

- **No component consumer hard-codes these values.** All consumption is via Tailwind utilities derived from `@theme inline` in `index.css`.
- **Adding a token** is non-breaking as long as the existing token names remain.
- **Changing a token's value** is allowed; the contrast audit test MUST continue to pass (SC-002).
- **Renaming or removing a token** is a breaking change and requires a follow-up feature to update every consumer.

## Automated validation

`apps/web/src/__tests__/contrast.audit.test.ts` parses the `:root` and `.dark` blocks of `apps/web/src/index.css`, resolves every token listed above, and asserts:

1. Every "Contrast pair" row in this document satisfies its stated minimum ratio (WCAG AA).
2. Both light and dark variants are defined (no token present only in one mode).
3. `--primary` hue remains in the documented blue range (`oklch` hue 210–240) — guards against accidental palette drift.

`apps/web/src/__tests__/typography.audit.test.ts` parses the `:root` block and asserts:

1. Every typography token enumerated above is defined (no missing step).
2. Line-height ≥ font-size × 1.2 for every size step (readability floor).
3. `@theme inline` re-exports every size token as a Tailwind utility.
