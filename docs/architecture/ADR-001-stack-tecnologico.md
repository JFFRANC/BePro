# ADR-001: Stack Tecnológico

## Estado: Aprobado
## Fecha: 2026-03-18

## Contexto
BePro necesita un sistema web modular para reemplazar procesos manuales en Google Sheets/Forms.
Se requiere soporte para ~500 usuarios con diferentes roles.

## Decisión
- **Frontend:** Next.js 14+ con TypeScript (App Router)
- **Backend:** .NET 8 Web API
- **BD:** PostgreSQL con EF Core 8
- **Auth:** JWT + Refresh Tokens con roles
- **Deploy:** Vercel (front) + Render (API + DB)
- **CI/CD:** GitHub Actions

## Razones
- Next.js: SSR/SSG para performance, App Router es el estándar actual, curva de aprendizaje natural desde React
- .NET 8: dominio existente del desarrollador, excelente performance, tipado fuerte
- PostgreSQL: gratuito, robusto, excelente soporte en Render/Supabase
- Vercel + Render: costo mínimo para iniciar, escalable cuando se necesite

## Consecuencias
- El desarrollador aprenderá Next.js durante el proyecto
- Se evitan contenedores (Docker) por ahora para simplificar
- La comunicación front-back será vía REST API (no server actions de Next.js hacia .NET)
