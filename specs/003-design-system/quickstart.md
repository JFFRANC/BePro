# Quickstart: Design System

**Feature**: 003-design-system | **Date**: 2026-04-03

## Prerequisites

- Node.js 18+, pnpm
- BePro monorepo cloned and dependencies installed (`pnpm install`)
- Branch `003-design-system` checked out

## Dev Server

```bash
cd apps/web
pnpm dev
# Opens at http://localhost:5173
```

## Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/index.css` | All design tokens (colors, typography, radius, animations) |
| `apps/web/index.html` | Google Fonts `<link>` tags |
| `apps/web/src/components/ui/badge.tsx` | Badge component with 14 FSM variants |
| `apps/web/src/components/ui/button.tsx` | Button component (shadcn/ui) |
| `apps/web/src/components/ui/input.tsx` | Input component (shadcn/ui) |
| `apps/web/src/components/theme-provider.tsx` | Multi-tenant ThemeProvider |
| `apps/web/src/lib/utils.ts` | `cn()` utility (already exists) |

## Installing shadcn/ui Components

```bash
cd apps/web
npx shadcn@latest add button badge input card
```

Components are copied to `src/components/ui/` and can be customized directly.

## Using Design Tokens

```tsx
// Tokens are available as Tailwind utilities
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Primary Button
</button>

// Extended semantic colors
<div className="bg-success text-success-foreground">Approved</div>
<div className="bg-warning text-warning-foreground">Pending Review</div>

// Typography
<h1 className="font-heading text-4xl font-bold tracking-tight">Dashboard</h1>
<p className="font-sans text-base text-muted-foreground">Welcome back</p>

// Dark mode (automatic via .dark class on <html>)
// All tokens have both light and dark values
```

## Using Status Badges

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="status-hired">Contratado</Badge>
<Badge variant="status-rejected">Rechazado</Badge>
<Badge variant="status-pending">Pendiente</Badge>
```

## Using ThemeProvider (Multi-tenant)

```tsx
import { ThemeProvider } from "@/components/theme-provider";

// In App.tsx — wraps the app
<ThemeProvider theme={tenantTheme}>
  <BrowserRouter>
    {/* All components automatically use tenant colors */}
  </BrowserRouter>
</ThemeProvider>
```

## Running Tests

```bash
cd apps/web
pnpm test                    # Run all tests
pnpm vitest --watch          # Watch mode
pnpm typecheck               # Type check only
```

## Verifying Contrast

All color pairs are designed for WCAG AA (4.5:1 text, 3:1 UI). To verify manually:

1. Open browser DevTools
2. Inspect a colored element
3. Check the contrast ratio in the color picker
4. All `--*-foreground` / `--*` pairs should pass AA
