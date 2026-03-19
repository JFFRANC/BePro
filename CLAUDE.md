# BePro - Sistema de Reclutamiento y Selección de Personal

## Descripción del Proyecto
Sistema web modular para la empresa BePro, dedicada al reclutamiento y selección de personal.
Reemplaza procesos manuales basados en Google Sheets y Google Forms.
El sistema gestiona el ciclo completo: registro de candidatos, seguimiento de vacantes,
control de entrevistas y colocación de candidatos en empresas cliente.

## Stack Tecnológico
- **Frontend:** Next.js 14+ (App Router) con React 18+ y TypeScript
- **Backend:** .NET 8 Web API con C#
- **Base de datos:** PostgreSQL 16+
- **ORM:** Entity Framework Core 8
- **Autenticación:** JWT + Refresh Tokens
- **CI/CD:** GitHub Actions
- **Deploy:** Vercel (frontend) + Render (API + PostgreSQL)

## Estructura del Repositorio
```
bepro/
├── src/
│   ├── frontend/          # Next.js app
│   │   ├── app/           # App Router pages
│   │   ├── components/    # Componentes reutilizables
│   │   ├── lib/           # Utilidades y helpers
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # Llamadas a API
│   │   ├── store/         # Estado global
│   │   └── types/         # TypeScript types/interfaces
│   └── backend/
│       └── BePro.API/     # Solución .NET
│           ├── BePro.API/           # Proyecto Web API (controllers, middleware)
│           ├── BePro.Core/          # Entidades, interfaces, DTOs
│           ├── BePro.Infrastructure/# EF Core, repositorios, servicios externos
│           └── BePro.Tests/         # Unit + Integration tests
├── docs/                  # Documentación del proyecto
│   ├── architecture/      # Decisiones de arquitectura
│   ├── api/               # Documentación de endpoints
│   └── modules/           # Documentación por módulo
├── scripts/               # Scripts de utilidad (seed, migraciones)
├── .github/
│   └── workflows/         # GitHub Actions CI/CD
├── CLAUDE.md              # Este archivo
└── README.md              # Solo si se solicita
```

## Arquitectura
- **Patrón:** Clean Architecture (Core → Infrastructure → API)
- **API:** RESTful con versionado (v1, v2...)
- **Frontend:** Server Components por defecto, Client Components cuando se necesite interactividad
- **Autenticación:** JWT con roles y claims
- **Base de datos:** Code-First con migraciones de EF Core

## Módulos del Sistema (por orden de implementación)
1. **Autenticación y Usuarios** - Login, roles, permisos
2. **Operaciones** - Módulo principal (reemplaza Google Sheets/Forms)
   - Gestión de candidatos
   - Gestión de vacantes
   - Control de entrevistas
   - Seguimiento de colocaciones
3. *(Módulos futuros se definirán progresivamente)*

## Roles del Sistema
| Rol | Descripción |
|-----|-------------|
| `admin` | Dirección General - acceso total |
| `leader_manager` | Líder de líderes - supervisa equipos |
| `leader` | Líder de reclutadores - gestiona su equipo |
| `recruiter` | Reclutador interno - operación diaria |
| `freelancer` | Reclutador freelancer - acceso limitado |

## Convenciones de Código

### General
- Idioma del código: **inglés** (variables, funciones, clases)
- Idioma de comentarios y documentación: **español**
- Commits en español siguiendo Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

### Frontend (Next.js / TypeScript)
- Componentes: PascalCase (`CandidateCard.tsx`)
- Hooks: camelCase con prefijo `use` (`useCandidates.ts`)
- Servicios: camelCase (`candidateService.ts`)
- Types/Interfaces: PascalCase con prefijo `I` para interfaces (`ICandidate.ts`)
- Estilos: CSS Modules o Tailwind CSS
- Estado: Zustand o React Context (según complejidad)

### Backend (.NET / C#)
- Controllers: PascalCase plural (`CandidatesController.cs`)
- Entidades: PascalCase singular (`Candidate.cs`)
- DTOs: PascalCase con sufijo (`CandidateDto.cs`, `CreateCandidateRequest.cs`)
- Interfaces: prefijo `I` (`ICandidateRepository.cs`)
- Async methods: sufijo `Async` (`GetCandidatesAsync`)

### Base de Datos
- Tablas: snake_case plural (`candidates`, `job_positions`)
- Columnas: snake_case (`first_name`, `created_at`)
- Todas las tablas incluyen: `id`, `created_at`, `updated_at`, `is_active`

### Git
- Branch principal: `main`
- Feature branches: `feature/nombre-descriptivo`
- Fix branches: `fix/nombre-descriptivo`
- PRs obligatorios para merge a main

## Reglas para Claude
- No crear archivos README.md a menos que se solicite
- No agregar comentarios innecesarios al código
- Preferir código simple y legible sobre abstracciones prematuras
- Siempre leer archivos existentes antes de modificarlos
- Ejecutar builds/tests después de cambios significativos
- Cuando se analicen archivos Excel de la empresa, documentar hallazgos en `docs/modules/`
- Consultar la memoria del proyecto antes de tomar decisiones de arquitectura
