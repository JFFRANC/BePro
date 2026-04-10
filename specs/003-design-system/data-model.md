# Data Model: Design System

**Feature**: 003-design-system | **Date**: 2026-04-03

## Entities

### Design Token

A named CSS custom property that maps to a visual value. All tokens follow the shadcn/ui convention: bare variable in `:root`/`.dark`, mapped to Tailwind namespace in `@theme inline`.

| Attribute | Description |
|-----------|-------------|
| Name | CSS custom property name (e.g., `--primary`) |
| Light Value | OKLch value for `:root` scope |
| Dark Value | OKLch value for `.dark` scope |
| Tailwind Mapping | `@theme inline` key (e.g., `--color-primary: var(--primary)`) |
| Category | color, typography, spacing, radius, animation |

**Token Categories & Counts**:

| Category | Token Count | Notes |
|----------|-------------|-------|
| Core semantic colors | 20 pairs | primary, secondary, accent, muted, destructive + foregrounds; background, foreground, card, popover + foregrounds |
| Extended semantic colors | 6 pairs | success, warning, info + foregrounds |
| Utility colors | 3 | border, input, ring |
| Sidebar colors | 8 | sidebar + foreground, primary, accent, border, ring |
| Chart colors | 5 | chart-1 through chart-5 |
| Badge colors | 28 | 14 states x (bg + fg) |
| Typography | 3 families + 28 scale tokens | font-heading, font-sans, font-mono + 7 levels x 4 props |
| Radius | 1 base + 6 derived | --radius + sm, md, lg, xl, 2xl, 3xl |
| Animations | 8 tokens + 8 keyframes | fade-in, fade-out, slide-in-up, slide-in-down, scale-in, accordion-down, accordion-up, spin |

### Badge Variant

A status-specific styling set mapped to a candidate FSM state.

| Attribute | Description |
|-----------|-------------|
| Status Key | Canonical FSM state name (e.g., `Registered`) |
| CSS Var (bg) | Background color variable (e.g., `--badge-registered-bg`) |
| CSS Var (fg) | Foreground color variable (e.g., `--badge-registered-fg`) |
| Semantic Group | progress, success, negative, neutral-terminal |
| Is Final | Whether the state is terminal (affects visual treatment) |
| CVA Variant | kebab-case key for CVA (e.g., `status-registered`) |

**Badge Status Map**:

| FSM State | Semantic Group | CVA Variant | Final? | Hue Range |
|-----------|---------------|-------------|--------|-----------|
| Registered | progress | `status-registered` | No | H:220 |
| InterviewScheduled | progress | `status-interview-scheduled` | No | H:200 |
| Attended | progress | `status-attended` | No | H:185 |
| Pending | progress | `status-pending` | No | H:240 |
| Approved | success | `status-approved` | No | H:150 |
| Hired | success | `status-hired` | No | H:140 |
| InGuarantee | success | `status-in-guarantee` | No | H:158 |
| GuaranteeMet | success | `status-guarantee-met` | Yes | H:135 |
| Rejected | negative | `status-rejected` | Yes | H:25 |
| Declined | negative | `status-declined` | Yes | H:35 |
| NoShow | negative | `status-no-show` | Yes | H:50 |
| Termination | negative | `status-termination` | Yes | H:15 |
| Discarded | neutral-terminal | `status-discarded` | Yes | H:175 (low chroma) |
| Replacement | neutral-terminal | `status-replacement` | Yes | H:200 (low chroma) |

### Tenant Theme

A data record for per-tenant visual customization. Not stored in this feature (deferred to tenant management module), but the shape is defined here for the ThemeProvider interface.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| primary | string (OKLch) | No | Brand primary color override |
| primaryForeground | string (OKLch) | No | Primary text color override |
| secondary | string (OKLch) | No | Secondary color override |
| secondaryForeground | string (OKLch) | No | Secondary text override |
| accent | string (OKLch) | No | Accent color override |
| accentForeground | string (OKLch) | No | Accent text override |
| destructive | string (OKLch) | No | Destructive color override |
| background | string (OKLch) | No | Background override |
| foreground | string (OKLch) | No | Foreground text override |
| radius | string (rem) | No | Border radius base override |
| fontSans | string | No | Body font family override |
| fontHeading | string | No | Heading font family override |
| logoUrl | string (URL) | No | Tenant logo URL (R2) |

All fields are optional — unspecified fields fall back to BePro defaults in `index.css`.

### Type Scale Step

| Level | Font Family | Size (rem) | Line Height | Letter Spacing | Weight |
|-------|-------------|-----------|-------------|----------------|--------|
| h1 | Fraunces | 2.441 | 1.15 | -0.025em | 700 |
| h2 | Fraunces | 1.953 | 1.2 | -0.02em | 600 |
| h3 | Fraunces | 1.563 | 1.3 | -0.015em | 600 |
| h4 | Fraunces | 1.25 | 1.4 | -0.01em | 600 |
| body | Source Sans 3 | 1.0 | 1.6 | 0em | 400 |
| small | Source Sans 3 | 0.8 | 1.5 | 0.01em | 400 |
| caption | Source Sans 3 | 0.64 | 1.4 | 0.02em | 500 |
