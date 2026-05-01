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

### Module map (recent additions)

- `clients/components/PositionForm.tsx` — perfil completo de puesto en 7 secciones (acordeón shadcn). 011-US1.
- `clients/components/PositionDocumentSlot.tsx` — slot por tipo (`contract`/`pase_visita`); subir / reemplazar / descargar / eliminar. 011-US2.
- `clients/components/PositionVersionsPanel.tsx` — panel "Versiones" admin-only para archivados (FR-018). 011-US5.
- `clients/pages/PositionDetailPage.tsx` — `/clients/:id/positions/:posId`; read-only para recruiter, edit para admin/manager/AE. 011.
- `clients/components/DocumentManager.tsx` — **eliminado** en 011-US3 (los documentos viven ahora por puesto).
- `clients/components/CopyAddressButton.tsx` — copia `client.address` whitespace-normalizado al portapapeles via `navigator.clipboard.writeText`; toast con fallback manual en contextos no-secure. 012-US2.
- `clients/components/ContactDirectory.tsx` — extendido con columna **Puesto** (cargo del contacto, ≤120) en lectura, alta y edición inline. Empty string → NULL en API (E-08). 012-US5.
- `clients/components/ClientForm.tsx` — extendido con Textarea **Descripción** (≤2000, contador en vivo). Plain text en la UI; markdown se muestra literal. 012-US1.
- `clients/components/FormConfigFieldsEditor.tsx` — los 9 BASE_CANDIDATE_FIELDS aparecen como filas bloqueadas (badge "Campo base"); admin no puede borrar/renombrar. Guard de colisión client-side antes de submit. 012-US4.
- `clients/pages/ClientDetailPage.tsx` — refactor a 2-col grid (`md:grid-cols-2`): mapa + dirección + clipboard izquierda, descripción + info general derecha; mobile coloca el mapa al final. Tab `value="config"` → `value="form"` (label "Formulario"); useEffect-redirect desde `/clients/:id/config` a `/clients/:id`. 012-US1+US2+US3.
- `candidates/components/CandidateForm.tsx` — fusiona BASE_CANDIDATE_FIELDS al inicio del schema dinámico (FR-009/FR-012); positionId es Select alimentado por `client_positions`; recruiterName + accountExecutiveName se prefiltran desde props. 012-US4.
- `candidates/pages/NewCandidatePage.tsx` — pasa `positionOptions`, `recruiterName` (desde `useAuth().user`) y `accountExecutiveName` (desde `useClient(...).primaryAccountExecutiveName`) a `CandidateForm`. 012-US4.

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
