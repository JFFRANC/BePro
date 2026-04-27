# BePro Web — React + Vite SPA

## Stack
- **Framework:** React 19 + Vite 6
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **State:** Zustand (client) + TanStack Query (server)
- **Forms:** React Hook Form + Zod (via @hookform/resolvers)
- **Routing:** react-router-dom v7
- **Deploy:** Cloudflare Pages

## Module Structure
Each domain module lives in `src/modules/{name}/`:
```
src/modules/candidates/
├── components/    # Module-specific components
├── hooks/         # TanStack Query hooks
└── services/      # API client functions
```

## Patterns

### Shared Components
- `src/components/ui/` — shadcn/ui components (install via `npx shadcn@latest add`)
- `src/components/` — App-level shared components (layout, navigation)

### Data Fetching
Use TanStack Query with query key factories:
```typescript
export const CANDIDATE_KEYS = {
  all: ["candidates"] as const,
  detail: (id: string) => ["candidates", id] as const,
};
```

### Forms
React Hook Form + Zod schemas from `@bepro/shared`:
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@bepro/shared";

const form = useForm<LoginFormValues>({
  resolver: zodResolver(loginSchema),
});
```

### Environment Variables
Use `import.meta.env.VITE_*` (not `process.env`).
API calls go through the Vite dev proxy (`/api` → `localhost:8787`).

### Styling
- Use `cn()` from `@/lib/utils` for conditional classes
- Design tokens defined in `src/index.css` (OKLch color space)
- Dark mode via `.dark` class on root element

## Commands
- `pnpm dev` — Start Vite dev server (port 5173)
- `pnpm build` — Type check + production build
- `pnpm test` — Run Vitest
- `pnpm typecheck` — Type check only
