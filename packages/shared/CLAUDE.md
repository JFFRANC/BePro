# BePro Shared — Tipos + Schemas Zod

## Stack
- TypeScript 5.8 (strict)
- Zod 4.x (validación)
- Sin dependencias runtime más allá de zod

## Layout
```
packages/shared/src/
├── candidates/
├── clients/
├── schemas/         # createUserSchema, loginSchema, etc.
├── types/
└── index.ts         # re-exports públicos
```

Cada submódulo expone tipos (`I*Dto`, `*Form*Values`) y/o schemas Zod.
Los consumidores (apps/api, apps/web) hacen `import { createUserSchema } from "@bepro/shared"`.

## ⚠️ Gotcha: dist/ se cachea

`@bepro/shared` se publica como CommonJS compilado en `dist/`:

```jsonc
// packages/shared/package.json
"main": "./dist/index.js",
"types": "./dist/index.d.ts"
```

Cuando editas un schema en `src/`, los consumidores **siguen leyendo `dist/`** hasta que rebuildees. Esto se manifiesta como:
- Los tests del consumidor siguen pasando con la lógica vieja.
- Los hooks (zValidator, zodResolver) ignoran un `.refine()` recién agregado.
- Errores 422 vs 409 desconcertantes en routes tests.

### Cómo evitarlo

Tras editar `packages/shared/src/**`, corre:
```bash
pnpm --filter @bepro/shared build
```

Luego corre los tests del consumidor. La cadena `pnpm typecheck` también lo hace correctamente porque incluye el build de shared como dependencia.

### Workflow alternativo (para sesiones de desarrollo largas)

`pnpm --filter @bepro/shared build --watch` en una terminal separada — recompila en cada save, así los consumidores siempre ven la última versión.

### Por qué no `tsx` directo

`tsx` o `vite-node` apuntando a `src/` evitaría el problema, pero romperia el shape de runtime que esperan apps/api (Cloudflare Workers) y apps/web (Vite SSR-compatible build). El compromiso es: `dist/` para producción, build manual durante desarrollo.

## Convenciones
- Schemas: `<entity>Schema` (camelCase) en `schemas/<entity>.ts`
- DTOs: `I<Entity>Dto` en `types/<entity>.ts`
- Form values: `<Entity>FormValues` (inferidos vía `z.infer`)
- Mensajes Zod en español (UI los muestra directo)
- Nada de side effects en módulos — el bundle del Worker debe permanecer pequeño

## Tests
Los tests viven en `<submodule>/__tests__/` y se corren con:
```bash
pnpm --filter @bepro/shared test
```

No requieren rebuild previo — vitest lee directamente de `src/`.
