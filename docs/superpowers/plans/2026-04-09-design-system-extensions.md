# Design System Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the BePro design system with missing components, patterns, and application-level infrastructure (sidebar nav, search/filters, CASL roles, error handling, dynamic forms, confirm dialogs) needed by upcoming modules.

**Architecture:** 6 phases building on the existing design system branch (003-design-system). Each phase installs/builds components, writes tests (TDD), and adds a preview section to `/design-system`. Components use existing design tokens, Lucide icons, and shadcn/ui primitives.

**Tech Stack:** React 19, TypeScript strict, Tailwind v4, shadcn/ui (base-nova), @casl/ability + @casl/react, React Hook Form + Zod 4, TanStack Query, Sonner, Lucide React, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-09-design-system-extensions-design.md`

**Working directory:** `apps/web/` (unless stated otherwise)

**Test command:** `pnpm test` (from `apps/web/`)
**Typecheck command:** `pnpm typecheck` (from `apps/web/`)

---

## Task 0: Prerequisites — Fix Shared Type Naming

**Files:**
- Modify: `packages/shared/src/types/candidate.ts`
- Modify: `packages/shared/src/types/client.ts`
- Create: `apps/web/src/lib/status-utils.ts`
- Test: `apps/web/src/__tests__/status-utils.test.ts`

- [ ] **Step 1: Rename `guarantee_failed` to `termination` in candidate types**

In `packages/shared/src/types/candidate.ts`, replace `"guarantee_failed"` with `"termination"` in the `CandidateStatus` type.

Also update `RejectionCategory` to match the spec's 10 categories:
```typescript
export type RejectionCategory =
  | "interview_performance"
  | "salary_expectations"
  | "schedule_incompatibility"
  | "location_distance"
  | "personal_decision"
  | "age_requirements"
  | "experience_level"
  | "documentation_issues"
  | "health_requirements"
  | "other";
```

- [ ] **Step 2: Rename `leaderId` to `accountExecutiveId` in candidate types**

In `packages/shared/src/types/candidate.ts`, rename:
- `leaderId` → `accountExecutiveId`
- `leaderFullName` → `accountExecutiveFullName`

In `ICandidateDto` (lines 48-49).

- [ ] **Step 3: Rename `leaderId` to `accountExecutiveId` in client types**

In `packages/shared/src/types/client.ts`, rename:
- `leaderId` → `accountExecutiveId` (in `IClientAssignmentDto`, line 28)
- `leaderFullName` → `accountExecutiveFullName` (in `IClientAssignmentDto`, line 29)
- `leaderId` → `accountExecutiveId` (in `IAssignUserRequest`, line 49)

- [ ] **Step 4: Write failing test for statusToBadgeVariant utility**

Create `apps/web/src/__tests__/status-utils.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { statusToBadgeVariant, badgeVariantToStatus } from "@/lib/status-utils";

describe("statusToBadgeVariant", () => {
  it("converts snake_case status to kebab-case badge variant", () => {
    expect(statusToBadgeVariant("interview_scheduled")).toBe("status-interview-scheduled");
    expect(statusToBadgeVariant("no_show")).toBe("status-no-show");
    expect(statusToBadgeVariant("in_guarantee")).toBe("status-in-guarantee");
    expect(statusToBadgeVariant("guarantee_met")).toBe("status-guarantee-met");
    expect(statusToBadgeVariant("registered")).toBe("status-registered");
    expect(statusToBadgeVariant("termination")).toBe("status-termination");
  });
});

describe("badgeVariantToStatus", () => {
  it("converts kebab-case badge variant back to snake_case status", () => {
    expect(badgeVariantToStatus("status-interview-scheduled")).toBe("interview_scheduled");
    expect(badgeVariantToStatus("status-no-show")).toBe("no_show");
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose status-utils`
Expected: FAIL — module not found

- [ ] **Step 6: Implement statusToBadgeVariant**

Create `apps/web/src/lib/status-utils.ts`:
```typescript
import type { CandidateStatus } from "@bepro/shared";

export function statusToBadgeVariant(status: CandidateStatus): string {
  return `status-${status.replace(/_/g, "-")}`;
}

export function badgeVariantToStatus(variant: string): CandidateStatus {
  return variant.replace("status-", "").replace(/-/g, "_") as CandidateStatus;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd apps/web && pnpm test -- --reporter=verbose status-utils`
Expected: PASS

- [ ] **Step 8: Typecheck shared package**

Run: `cd packages/shared && pnpm typecheck`
Expected: PASS (no consumers reference old names yet)

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/types/candidate.ts packages/shared/src/types/client.ts apps/web/src/lib/status-utils.ts apps/web/src/__tests__/status-utils.test.ts
git commit -m "fix(shared): rename guarantee_failed→termination, leaderId→accountExecutiveId, add statusToBadgeVariant"
```

---

## Task 1: Rename ProtectedRoute to RequireAuth

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Rename ProtectedRoute to RequireAuth in App.tsx**

In `apps/web/src/App.tsx`, rename the function `ProtectedRoute` to `RequireAuth` (line 10) and update its usage (line 63).

- [ ] **Step 2: Run typecheck and tests**

Run: `cd apps/web && pnpm typecheck && pnpm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "refactor(web): rename ProtectedRoute to RequireAuth for auth vs authorization clarity"
```

---

## Task 2: Install shadcn/ui Primitives (Sheet, Switch, ScrollArea, Collapsible)

**Files:**
- Create: `apps/web/src/components/ui/sheet.tsx` (by CLI)
- Create: `apps/web/src/components/ui/switch.tsx` (by CLI)
- Create: `apps/web/src/components/ui/scroll-area.tsx` (by CLI)
- Create: `apps/web/src/components/ui/collapsible.tsx` (by CLI)
- Test: `apps/web/src/__tests__/primitives.test.tsx`

- [ ] **Step 1: Install components via shadcn CLI**

Run from `apps/web/`:
```bash
npx shadcn@latest add sheet switch scroll-area collapsible -y
```

- [ ] **Step 2: Verify files were created**

Run: `ls apps/web/src/components/ui/{sheet,switch,scroll-area,collapsible}.tsx`
Expected: all 4 files exist

- [ ] **Step 3: Write failing tests for installed primitives**

Create `apps/web/src/__tests__/primitives.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

describe("Sheet", () => {
  it("renders trigger", () => {
    render(
      <Sheet>
        <SheetTrigger>Open</SheetTrigger>
        <SheetContent>Content</SheetContent>
      </Sheet>
    );
    expect(screen.getByText("Open")).toBeDefined();
  });
});

describe("Switch", () => {
  it("renders with aria role", () => {
    render(<Switch aria-label="Toggle" />);
    expect(screen.getByRole("switch")).toBeDefined();
  });
});

describe("ScrollArea", () => {
  it("renders children", () => {
    render(<ScrollArea className="h-40"><p>Scrollable content</p></ScrollArea>);
    expect(screen.getByText("Scrollable content")).toBeDefined();
  });
});

describe("Collapsible", () => {
  it("renders trigger", () => {
    render(
      <Collapsible>
        <CollapsibleTrigger>Toggle</CollapsibleTrigger>
        <CollapsibleContent>Hidden content</CollapsibleContent>
      </Collapsible>
    );
    expect(screen.getByText("Toggle")).toBeDefined();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose primitives`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `cd apps/web && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ui/sheet.tsx apps/web/src/components/ui/switch.tsx apps/web/src/components/ui/scroll-area.tsx apps/web/src/components/ui/collapsible.tsx apps/web/src/__tests__/primitives.test.tsx
git commit -m "feat(web): install Sheet, Switch, ScrollArea, Collapsible primitives"
```

---

## Task 3: Build DatePicker Composition

**Files:**
- Create: `apps/web/src/components/date-picker.tsx`
- Test: `apps/web/src/__tests__/date-picker.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/date-picker.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DatePicker } from "@/components/date-picker";

describe("DatePicker", () => {
  it("renders with placeholder text", () => {
    render(<DatePicker placeholder="Seleccionar fecha" />);
    expect(screen.getByText("Seleccionar fecha")).toBeDefined();
  });

  it("renders with Calendar icon", () => {
    render(<DatePicker placeholder="Fecha" />);
    // The button should exist and be clickable
    const button = screen.getByRole("button");
    expect(button).toBeDefined();
  });

  it("accepts a value and displays formatted date", () => {
    const date = new Date(2026, 3, 9); // April 9, 2026
    render(<DatePicker value={date} placeholder="Fecha" />);
    // Should display the formatted date, not the placeholder
    expect(screen.queryByText("Fecha")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose date-picker`
Expected: FAIL

- [ ] **Step 3: Implement DatePicker**

Create `apps/web/src/components/date-picker.tsx`:
```tsx
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = "Seleccionar fecha", disabled, className }: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP", { locale: es }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose date-picker`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/date-picker.tsx apps/web/src/__tests__/date-picker.test.tsx
git commit -m "feat(web): add DatePicker composition (Calendar + Popover + Button)"
```

---

## Task 4: Build Error Pages

**Files:**
- Create: `apps/web/src/components/error-page.tsx`
- Test: `apps/web/src/__tests__/error-page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/error-page.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ErrorPage } from "@/components/error-page";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ErrorPage", () => {
  it("renders 403 with correct title and description", () => {
    renderWithRouter(<ErrorPage code={403} />);
    expect(screen.getByText("Acceso denegado")).toBeDefined();
    expect(screen.getByText("No tienes permisos para ver esta página")).toBeDefined();
    expect(screen.getByText("Ir al Dashboard")).toBeDefined();
  });

  it("renders 404 with correct title", () => {
    renderWithRouter(<ErrorPage code={404} />);
    expect(screen.getByText("Página no encontrada")).toBeDefined();
  });

  it("renders 500 with retry button", () => {
    renderWithRouter(<ErrorPage code={500} onRetry={() => {}} />);
    expect(screen.getByText("Error del servidor")).toBeDefined();
    expect(screen.getByText("Reintentar")).toBeDefined();
  });

  it("renders custom title and description", () => {
    renderWithRouter(<ErrorPage code={403} title="Custom" description="Custom desc" />);
    expect(screen.getByText("Custom")).toBeDefined();
    expect(screen.getByText("Custom desc")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose error-page`
Expected: FAIL

- [ ] **Step 3: Implement ErrorPage**

Create `apps/web/src/components/error-page.tsx`:
```tsx
import { useNavigate } from "react-router-dom";
import { ShieldAlert, SearchX, ServerCrash, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const errorConfig = {
  403: {
    icon: ShieldAlert,
    title: "Acceso denegado",
    description: "No tienes permisos para ver esta página",
    actionLabel: "Ir al Dashboard",
    colorClass: "text-destructive",
  },
  404: {
    icon: SearchX,
    title: "Página no encontrada",
    description: "La página que buscas no existe",
    actionLabel: "Ir al Dashboard",
    colorClass: "text-muted-foreground",
  },
  500: {
    icon: ServerCrash,
    title: "Error del servidor",
    description: "Algo salió mal, intenta de nuevo",
    actionLabel: "Reintentar",
    colorClass: "text-destructive",
  },
} as const;

interface ErrorPageProps {
  code: 403 | 404 | 500;
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorPage({ code, title, description, onRetry }: ErrorPageProps) {
  const navigate = useNavigate();
  const config = errorConfig[code];
  const Icon = config.icon;

  function handleAction() {
    if (code === 500 && onRetry) {
      onRetry();
    } else {
      navigate("/");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8">
          <Icon className={`h-16 w-16 ${config.colorClass}`} />
          <h1 className="font-heading text-2xl font-bold">{title ?? config.title}</h1>
          <p className="text-muted-foreground">{description ?? config.description}</p>
          <Button onClick={handleAction} variant={code === 500 ? "default" : "outline"}>
            {code === 500 ? <RefreshCw className="mr-2 h-4 w-4" /> : null}
            {code === 500 ? (onRetry ? "Reintentar" : config.actionLabel) : config.actionLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose error-page`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/error-page.tsx apps/web/src/__tests__/error-page.test.tsx
git commit -m "feat(web): add ErrorPage component (403/404/500)"
```

---

## Task 5: Build Error Boundary

**Files:**
- Create: `apps/web/src/components/error-boundary.tsx`
- Test: `apps/web/src/__tests__/error-boundary.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/error-boundary.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";

function BrokenComponent(): JSX.Element {
  throw new Error("Test crash");
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <p>Working</p>
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText("Working")).toBeDefined();
  });

  it("catches render errors and shows error page", () => {
    // Suppress console.error from React for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText("Error del servidor")).toBeDefined();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose error-boundary`
Expected: FAIL

- [ ] **Step 3: Implement ErrorBoundary**

Create `apps/web/src/components/error-boundary.tsx`:
```tsx
import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { ErrorPage } from "@/components/error-page";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log without PII per LFPDPPP
    console.error("ErrorBoundary caught:", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          code={500}
          onRetry={() => this.setState({ hasError: false })}
        />
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose error-boundary`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/error-boundary.tsx apps/web/src/__tests__/error-boundary.test.tsx
git commit -m "feat(web): add ErrorBoundary with 500 error page fallback"
```

---

## Task 6: Build Offline Banner

**Files:**
- Create: `apps/web/src/components/offline-banner.tsx`
- Test: `apps/web/src/__tests__/offline-banner.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/offline-banner.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OfflineBanner } from "@/components/offline-banner";

describe("OfflineBanner", () => {
  let originalOnLine: boolean;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { value: originalOnLine, writable: true });
  });

  it("does not render when online", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    render(<OfflineBanner />);
    expect(screen.queryByText(/Sin conexión/)).toBeNull();
  });

  it("renders warning banner when offline", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });
    render(<OfflineBanner />);
    expect(screen.getByText(/Sin conexión/)).toBeDefined();
  });

  it("shows banner when going offline via event", () => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
    render(<OfflineBanner />);
    expect(screen.queryByText(/Sin conexión/)).toBeNull();

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, writable: true });
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText(/Sin conexión/)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose offline-banner`
Expected: FAIL

- [ ] **Step 3: Implement OfflineBanner**

Create `apps/web/src/components/offline-banner.tsx`:
```tsx
import { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";
import { toast } from "sonner";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true);
    }
    function handleOnline() {
      setIsOffline(false);
      toast.success("Conexión restaurada");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground">
      <WifiOff className="h-4 w-4" />
      Sin conexión — los cambios se sincronizarán al reconectar
    </div>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose offline-banner`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/offline-banner.tsx apps/web/src/__tests__/offline-banner.test.tsx
git commit -m "feat(web): add OfflineBanner with warning color tokens"
```

---

## Task 7: Update TanStack Query Config

**Files:**
- Modify: `apps/web/src/lib/query-client.ts`
- Test: `apps/web/src/__tests__/query-client.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/query-client.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { queryClient } from "@/lib/query-client";

describe("queryClient", () => {
  it("has retry set to 3 for queries", () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(3);
  });

  it("has staleTime set to 30 seconds", () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it("has retry set to 1 for mutations", () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose query-client`
Expected: FAIL — retry is 1, staleTime is 300000

- [ ] **Step 3: Update query-client.ts**

Replace contents of `apps/web/src/lib/query-client.ts`:
```typescript
import { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function handleMutationError(error: unknown) {
  const err = error as { status?: number; message?: string };
  const status = err?.status;

  if (status === 401) {
    // Auth store clears itself via interceptor — just notify
    toast.error("Sesión expirada, inicia sesión de nuevo");
    return;
  }
  if (status === 403) {
    toast.error("No tienes permisos para esta acción");
    return;
  }
  if (!navigator.onLine || !status) {
    toast.error("Verifica tu conexión a internet");
    return;
  }
  if (status >= 500) {
    toast.error("Error del servidor, intenta de nuevo");
    return;
  }
  toast.error(err?.message ?? "Algo salió mal");
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 30_000,
    },
    mutations: {
      retry: 1,
      onError: handleMutationError,
    },
  },
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose query-client`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd apps/web && pnpm test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/query-client.ts apps/web/src/__tests__/query-client.test.ts
git commit -m "feat(web): update QueryClient with retry, staleTime, and global mutation error handler"
```

---

## Task 8: Install CASL and Build Ability Definitions

**Files:**
- Create: `apps/web/src/lib/ability.ts`
- Test: `apps/web/src/__tests__/ability.test.ts`

- [ ] **Step 1: Install CASL packages**

Run from `apps/web/`:
```bash
pnpm add @casl/ability @casl/react
```

- [ ] **Step 2: Write failing test**

Create `apps/web/src/__tests__/ability.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { defineAbilityFor } from "@/lib/ability";

describe("defineAbilityFor", () => {
  it("admin can manage all", () => {
    const ability = defineAbilityFor({ role: "admin", id: "1" });
    expect(ability.can("manage", "all")).toBe(true);
    expect(ability.can("delete", "User")).toBe(true);
    expect(ability.can("create", "Candidate")).toBe(true);
  });

  it("manager can read all and create/update Candidate/Placement", () => {
    const ability = defineAbilityFor({ role: "manager", id: "2" });
    expect(ability.can("read", "Dashboard")).toBe(true);
    expect(ability.can("read", "User")).toBe(true);
    expect(ability.can("create", "Candidate")).toBe(true);
    expect(ability.can("update", "Placement")).toBe(true);
    expect(ability.can("delete", "User")).toBe(false);
    expect(ability.can("manage", "all")).toBe(false);
  });

  it("account_executive can read Dashboard/Candidate/Client/Placement, create/update Candidate/Placement", () => {
    const ability = defineAbilityFor({ role: "account_executive", id: "3" });
    expect(ability.can("read", "Dashboard")).toBe(true);
    expect(ability.can("read", "Candidate")).toBe(true);
    expect(ability.can("read", "Client")).toBe(true);
    expect(ability.can("create", "Candidate")).toBe(true);
    expect(ability.can("read", "User")).toBe(false);
    expect(ability.can("read", "Audit")).toBe(false);
  });

  it("recruiter can only read Dashboard/Candidate and create Candidate", () => {
    const ability = defineAbilityFor({ role: "recruiter", id: "4" });
    expect(ability.can("read", "Dashboard")).toBe(true);
    expect(ability.can("read", "Candidate")).toBe(true);
    expect(ability.can("create", "Candidate")).toBe(true);
    expect(ability.can("read", "Client")).toBe(false);
    expect(ability.can("update", "Candidate")).toBe(false);
    expect(ability.can("read", "User")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose ability`
Expected: FAIL

- [ ] **Step 4: Implement ability definitions**

Create `apps/web/src/lib/ability.ts`:
```typescript
import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";
import type { UserRole } from "@bepro/shared";

export type Actions = "manage" | "create" | "read" | "update" | "delete";
export type Subjects = "Dashboard" | "Candidate" | "Client" | "Placement" | "User" | "Audit" | "all";
export type AppAbility = MongoAbility<[Actions, Subjects]>;

interface AbilityUser {
  role: UserRole;
  id: string;
}

export function defineAbilityFor(user: AbilityUser): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case "admin":
      can("manage", "all");
      break;

    case "manager":
      can("read", "all");
      can(["create", "update"], ["Candidate", "Placement"]);
      break;

    case "account_executive":
      can("read", ["Dashboard", "Candidate", "Client", "Placement"]);
      can(["create", "update"], ["Candidate", "Placement"]);
      break;

    case "recruiter":
      can("read", ["Dashboard", "Candidate"]);
      can("create", "Candidate");
      break;
  }

  return build();
}
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose ability`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/ability.ts apps/web/src/__tests__/ability.test.ts apps/web/package.json ../../pnpm-lock.yaml
git commit -m "feat(web): add CASL ability definitions for 4 roles"
```

---

## Task 9: Build AbilityProvider, RoleGate, ProtectedRoute

**Files:**
- Create: `apps/web/src/components/ability-provider.tsx`
- Create: `apps/web/src/components/role-gate.tsx`
- Create: `apps/web/src/components/protected-route.tsx`
- Test: `apps/web/src/__tests__/role-gate.test.tsx`
- Test: `apps/web/src/__tests__/protected-route.test.tsx`

- [ ] **Step 1: Write failing test for RoleGate**

Create `apps/web/src/__tests__/role-gate.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AbilityProvider } from "@/components/ability-provider";
import { RoleGate } from "@/components/role-gate";
import { defineAbilityFor } from "@/lib/ability";

function renderWithAbility(role: string, ui: React.ReactElement) {
  const ability = defineAbilityFor({ role: role as any, id: "1" });
  return render(<AbilityProvider ability={ability}>{ui}</AbilityProvider>);
}

describe("RoleGate", () => {
  it("renders children when user has permission", () => {
    renderWithAbility("admin", <RoleGate action="read" subject="User"><p>Visible</p></RoleGate>);
    expect(screen.getByText("Visible")).toBeDefined();
  });

  it("hides children when user lacks permission", () => {
    renderWithAbility("recruiter", <RoleGate action="read" subject="User"><p>Hidden</p></RoleGate>);
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("renders fallback when user lacks permission", () => {
    renderWithAbility("recruiter", <RoleGate action="read" subject="User" fallback={<p>No access</p>}><p>Hidden</p></RoleGate>);
    expect(screen.queryByText("Hidden")).toBeNull();
    expect(screen.getByText("No access")).toBeDefined();
  });
});
```

- [ ] **Step 2: Write failing test for ProtectedRoute**

Create `apps/web/src/__tests__/protected-route.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { AbilityProvider } from "@/components/ability-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { defineAbilityFor } from "@/lib/ability";

function renderWithRoute(role: string, action: string, subject: string) {
  const ability = defineAbilityFor({ role: role as any, id: "1" });
  return render(
    <AbilityProvider ability={ability}>
      <MemoryRouter initialEntries={["/test"]}>
        <Routes>
          <Route element={<ProtectedRoute action={action as any} subject={subject as any} />}>
            <Route path="/test" element={<p>Protected content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AbilityProvider>
  );
}

describe("ProtectedRoute", () => {
  it("renders outlet when authorized", () => {
    renderWithRoute("admin", "read", "User");
    expect(screen.getByText("Protected content")).toBeDefined();
  });

  it("renders 403 error page when unauthorized", () => {
    renderWithRoute("recruiter", "read", "User");
    expect(screen.getByText("Acceso denegado")).toBeDefined();
    expect(screen.queryByText("Protected content")).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd apps/web && pnpm test -- --reporter=verbose role-gate protected-route`
Expected: FAIL

- [ ] **Step 4: Implement AbilityProvider**

Create `apps/web/src/components/ability-provider.tsx`:
```tsx
import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { createContextualCan } from "@casl/react";
import type { AppAbility } from "@/lib/ability";

const AbilityContext = createContext<AppAbility>(undefined!);

export const Can = createContextualCan(AbilityContext.Consumer);

export function useAppAbility(): AppAbility {
  return useContext(AbilityContext);
}

interface AbilityProviderProps {
  ability: AppAbility;
  children: ReactNode;
}

export function AbilityProvider({ ability, children }: AbilityProviderProps) {
  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}
```

- [ ] **Step 5: Implement RoleGate**

Create `apps/web/src/components/role-gate.tsx`:
```tsx
import type { ReactNode } from "react";
import { useAppAbility } from "@/components/ability-provider";
import type { Actions, Subjects } from "@/lib/ability";

interface RoleGateProps {
  action: Actions;
  subject: Subjects;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleGate({ action, subject, children, fallback = null }: RoleGateProps) {
  const ability = useAppAbility();

  if (ability.can(action, subject)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
```

- [ ] **Step 6: Implement ProtectedRoute**

Create `apps/web/src/components/protected-route.tsx`:
```tsx
import { Outlet } from "react-router-dom";
import { useAppAbility } from "@/components/ability-provider";
import { ErrorPage } from "@/components/error-page";
import type { Actions, Subjects } from "@/lib/ability";

interface ProtectedRouteProps {
  action: Actions;
  subject: Subjects;
}

export function ProtectedRoute({ action, subject }: ProtectedRouteProps) {
  const ability = useAppAbility();

  if (!ability.can(action, subject)) {
    return <ErrorPage code={403} />;
  }

  return <Outlet />;
}
```

- [ ] **Step 7: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose role-gate protected-route`
Expected: PASS

- [ ] **Step 8: Run full test suite + typecheck**

Run: `cd apps/web && pnpm typecheck && pnpm test`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ability-provider.tsx apps/web/src/components/role-gate.tsx apps/web/src/components/protected-route.tsx apps/web/src/__tests__/role-gate.test.tsx apps/web/src/__tests__/protected-route.test.tsx
git commit -m "feat(web): add AbilityProvider, RoleGate, ProtectedRoute with CASL"
```

---

## Task 10: Build ConfirmDialog

**Files:**
- Create: `apps/web/src/components/confirm-dialog.tsx`
- Test: `apps/web/src/__tests__/confirm-dialog.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/confirm-dialog.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialogProvider, useConfirm } from "@/components/confirm-dialog";

function TestConsumer({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button onClick={async () => {
      const result = await confirm({
        title: "Delete?",
        description: "This cannot be undone.",
        confirmLabel: "Delete",
        variant: "destructive",
      });
      onResult(result);
    }}>
      Trigger
    </button>
  );
}

describe("ConfirmDialog", () => {
  it("resolves true when confirmed", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmDialogProvider>
        <TestConsumer onResult={onResult} />
      </ConfirmDialogProvider>
    );

    await userEvent.click(screen.getByText("Trigger"));
    expect(screen.getByText("Delete?")).toBeDefined();
    await userEvent.click(screen.getByText("Delete"));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("resolves false when cancelled", async () => {
    const onResult = vi.fn();
    render(
      <ConfirmDialogProvider>
        <TestConsumer onResult={onResult} />
      </ConfirmDialogProvider>
    );

    await userEvent.click(screen.getByText("Trigger"));
    await userEvent.click(screen.getByText("Cancelar"));
    expect(onResult).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose confirm-dialog`
Expected: FAIL

- [ ] **Step 3: Check if @testing-library/user-event is installed**

Run: `cd apps/web && pnpm list @testing-library/user-event 2>/dev/null || pnpm add -D @testing-library/user-event`

- [ ] **Step 4: Implement ConfirmDialog**

Create `apps/web/src/components/confirm-dialog.tsx`:
```tsx
import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  icon?: LucideIcon;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(undefined!);

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function handleAction() {
    setOpen(false);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }

  function handleCancel() {
    setOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }

  const Icon = options?.icon;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={open} onOpenChange={(v) => !v && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {Icon && <Icon className="mx-auto h-10 w-10 text-muted-foreground" />}
            <AlertDialogTitle>{options?.title}</AlertDialogTitle>
            <AlertDialogDescription>{options?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {options?.cancelLabel ?? "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={options?.variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {options?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose confirm-dialog`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/confirm-dialog.tsx apps/web/src/__tests__/confirm-dialog.test.tsx
git commit -m "feat(web): add ConfirmDialog with useConfirm hook"
```

---

## Task 11: Build FormLayout Components

**Files:**
- Create: `apps/web/src/components/form-layout.tsx`
- Test: `apps/web/src/__tests__/form-layout.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/form-layout.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormLayout, FormSection, FormField, FormRow } from "@/components/form-layout";

describe("FormLayout", () => {
  it("renders title and description", () => {
    render(<FormLayout title="Registro" description="Completa los datos"><p>Fields</p></FormLayout>);
    expect(screen.getByText("Registro")).toBeDefined();
    expect(screen.getByText("Completa los datos")).toBeDefined();
    expect(screen.getByText("Fields")).toBeDefined();
  });
});

describe("FormSection", () => {
  it("renders section title", () => {
    render(<FormSection title="Datos personales"><p>Content</p></FormSection>);
    expect(screen.getByText("Datos personales")).toBeDefined();
    expect(screen.getByText("Content")).toBeDefined();
  });
});

describe("FormField", () => {
  it("renders label and error", () => {
    render(<FormField label="Nombre" error="Campo requerido"><input /></FormField>);
    expect(screen.getByText("Nombre")).toBeDefined();
    expect(screen.getByText("Campo requerido")).toBeDefined();
  });

  it("renders without error when not provided", () => {
    render(<FormField label="Email"><input /></FormField>);
    expect(screen.getByText("Email")).toBeDefined();
  });
});

describe("FormRow", () => {
  it("renders children in a grid", () => {
    render(<FormRow><p>A</p><p>B</p></FormRow>);
    expect(screen.getByText("A")).toBeDefined();
    expect(screen.getByText("B")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose form-layout`
Expected: FAIL

- [ ] **Step 3: Implement FormLayout components**

Create `apps/web/src/components/form-layout.tsx`:
```tsx
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface FormLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormLayout({ title, description, children, className }: FormLayoutProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-heading">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

interface FormSectionProps {
  title: string;
  children: ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <Separator />
      </div>
      {children}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  icon?: LucideIcon;
  children: ReactNode;
  htmlFor?: string;
}

export function FormField({ label, error, icon: Icon, children, htmlFor }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {label}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

interface FormRowProps {
  children: ReactNode;
}

export function FormRow({ children }: FormRowProps) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose form-layout`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/form-layout.tsx apps/web/src/__tests__/form-layout.test.tsx
git commit -m "feat(web): add FormLayout, FormSection, FormField, FormRow components"
```

---

## Task 12: Build Dynamic Form Renderer

**Files:**
- Create: `apps/web/src/components/dynamic-form.tsx`
- Test: `apps/web/src/__tests__/dynamic-form.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/__tests__/dynamic-form.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { IClientFormConfig } from "@bepro/shared";
import { DynamicCandidateForm } from "@/components/dynamic-form";

const allEnabled: IClientFormConfig = {
  showInterviewTime: true,
  showPosition: true,
  showMunicipality: true,
  showAge: true,
  showShift: true,
  showPlant: true,
  showInterviewPoint: true,
  showComments: true,
};

const allDisabled: IClientFormConfig = {
  showInterviewTime: false,
  showPosition: false,
  showMunicipality: false,
  showAge: false,
  showShift: false,
  showPlant: false,
  showInterviewPoint: false,
  showComments: false,
};

describe("DynamicCandidateForm", () => {
  it("always renders required fields (name, phone, date, client)", () => {
    render(<DynamicCandidateForm formConfig={allDisabled} clientName="Empresa A" onSubmit={vi.fn()} />);
    expect(screen.getByText("Nombre completo")).toBeDefined();
    expect(screen.getByText("Teléfono")).toBeDefined();
    expect(screen.getByText("Fecha de entrevista")).toBeDefined();
    expect(screen.getByText("Cliente")).toBeDefined();
  });

  it("shows optional fields when config enables them", () => {
    render(<DynamicCandidateForm formConfig={allEnabled} clientName="Empresa A" onSubmit={vi.fn()} />);
    expect(screen.getByText("Puesto")).toBeDefined();
    expect(screen.getByText("Edad")).toBeDefined();
    expect(screen.getByText("Turno")).toBeDefined();
    expect(screen.getByText("Planta")).toBeDefined();
    expect(screen.getByText("Punto de entrevista")).toBeDefined();
    expect(screen.getByText("Observaciones")).toBeDefined();
    expect(screen.getByText("Hora de entrevista")).toBeDefined();
  });

  it("hides optional fields when config disables them", () => {
    render(<DynamicCandidateForm formConfig={allDisabled} clientName="Empresa A" onSubmit={vi.fn()} />);
    expect(screen.queryByText("Puesto")).toBeNull();
    expect(screen.queryByText("Edad")).toBeNull();
    expect(screen.queryByText("Turno")).toBeNull();
    expect(screen.queryByText("Planta")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm test -- --reporter=verbose dynamic-form`
Expected: FAIL

- [ ] **Step 3: Implement DynamicCandidateForm**

Create `apps/web/src/components/dynamic-form.tsx`:
```tsx
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { IClientFormConfig } from "@bepro/shared";
import { User, Phone, Calendar, Building2, Briefcase, MapPin, UserCheck, Clock, Sun, Factory, Navigation, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormLayout, FormSection, FormField, FormRow } from "@/components/form-layout";

const baseSchema = z.object({
  fullName: z.string().min(1, "El nombre es requerido").max(200),
  phone: z.string().min(1, "El teléfono es requerido").max(20),
  interviewDate: z.string().min(1, "La fecha de entrevista es requerida"),
});

const optionalSchemas = {
  showInterviewTime: z.object({ interviewTime: z.string().optional() }),
  showPosition: z.object({ position: z.string().max(200).optional() }),
  showMunicipality: z.object({ municipality: z.string().max(200).optional() }),
  showAge: z.object({ age: z.coerce.number().min(16).max(99).optional() }),
  showShift: z.object({ shift: z.string().max(100).optional() }),
  showPlant: z.object({ plant: z.string().max(200).optional() }),
  showInterviewPoint: z.object({ interviewPoint: z.string().max(200).optional() }),
  showComments: z.object({ comments: z.string().max(1000).optional() }),
} as const;

function buildSchema(config: IClientFormConfig) {
  let schema = baseSchema;
  for (const [key, subSchema] of Object.entries(optionalSchemas)) {
    if (config[key as keyof IClientFormConfig]) {
      schema = schema.merge(subSchema) as typeof schema;
    }
  }
  return schema;
}

interface DynamicCandidateFormProps {
  formConfig: IClientFormConfig;
  clientName: string;
  onSubmit: (data: Record<string, unknown>) => void;
}

export function DynamicCandidateForm({ formConfig, clientName, onSubmit }: DynamicCandidateFormProps) {
  const schema = useMemo(() => buildSchema(formConfig), [formConfig]);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {},
  });

  return (
    <FormLayout title="Registro de Candidato" description="Completa los datos del candidato">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormSection title="Datos requeridos">
          <FormField label="Nombre completo" icon={User} error={errors.fullName?.message as string}>
            <Input {...register("fullName")} placeholder="Nombre del candidato" />
          </FormField>
          <FormField label="Teléfono" icon={Phone} error={errors.phone?.message as string}>
            <Input {...register("phone")} type="tel" placeholder="10 dígitos" />
          </FormField>
          <FormField label="Fecha de entrevista" icon={Calendar} error={errors.interviewDate?.message as string}>
            <Input {...register("interviewDate")} type="date" />
          </FormField>
          <FormField label="Cliente" icon={Building2}>
            <Input value={clientName} disabled />
          </FormField>
        </FormSection>

        {Object.values(formConfig).some(Boolean) && (
          <FormSection title="Datos adicionales">
            {formConfig.showInterviewTime && (
              <FormField label="Hora de entrevista" icon={Clock}>
                <Input {...register("interviewTime")} type="time" />
              </FormField>
            )}
            {formConfig.showPosition && (
              <FormField label="Puesto" icon={Briefcase}>
                <Input {...register("position")} placeholder="Puesto al que aplica" />
              </FormField>
            )}
            <FormRow>
              {formConfig.showAge && (
                <FormField label="Edad" icon={UserCheck}>
                  <Input {...register("age")} type="number" min={16} max={99} />
                </FormField>
              )}
              {formConfig.showShift && (
                <FormField label="Turno" icon={Sun}>
                  <Input {...register("shift")} placeholder="Matutino, vespertino..." />
                </FormField>
              )}
            </FormRow>
            {formConfig.showMunicipality && (
              <FormField label="Municipio" icon={MapPin}>
                <Input {...register("municipality")} placeholder="Municipio" />
              </FormField>
            )}
            {formConfig.showPlant && (
              <FormField label="Planta" icon={Factory}>
                <Input {...register("plant")} placeholder="Planta o sucursal" />
              </FormField>
            )}
            {formConfig.showInterviewPoint && (
              <FormField label="Punto de entrevista" icon={Navigation}>
                <Input {...register("interviewPoint")} placeholder="Lugar de la entrevista" />
              </FormField>
            )}
            {formConfig.showComments && (
              <FormField label="Observaciones" icon={MessageSquare}>
                <Textarea {...register("comments")} placeholder="Notas sobre el candidato..." />
              </FormField>
            )}
          </FormSection>
        )}

        <Button type="submit" className="w-full">Registrar candidato</Button>
      </form>
    </FormLayout>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && pnpm test -- --reporter=verbose dynamic-form`
Expected: PASS

- [ ] **Step 5: Run full suite + typecheck**

Run: `cd apps/web && pnpm typecheck && pnpm test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/dynamic-form.tsx apps/web/src/__tests__/dynamic-form.test.tsx
git commit -m "feat(web): add DynamicCandidateForm driven by IClientFormConfig"
```

---

## Task 13: Integrate Into App + Wire ErrorBoundary and OfflineBanner

**Files:**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add ErrorBoundary, OfflineBanner, and ConfirmDialogProvider to App.tsx**

Update `apps/web/src/App.tsx` to wrap the app with `ErrorBoundary`, add `OfflineBanner`, and wrap with `ConfirmDialogProvider`:

```tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { queryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { ConfirmDialogProvider } from "@/components/confirm-dialog";
import { LoginPage } from "@/modules/auth/pages/LoginPage";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { PreviewPage } from "@/modules/design-system/pages/PreviewPage";
import { ErrorPage } from "@/components/error-page";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">BePro</h1>
        <p className="text-muted-foreground">
          Bienvenido, {user?.firstName} {user?.lastName}
        </p>
        <p className="text-sm text-muted-foreground">Rol: {user?.role}</p>
        <button
          onClick={logout}
          className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider theme={null}>
      <QueryClientProvider client={queryClient}>
        <ConfirmDialogProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <OfflineBanner />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/design-system" element={<PreviewPage />} />
                <Route path="/403" element={<ErrorPage code={403} />} />
                <Route path="/404" element={<ErrorPage code={404} />} />
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <DashboardPage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<ErrorPage code={404} />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
          <Toaster />
        </ConfirmDialogProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Run full suite + typecheck**

Run: `cd apps/web && pnpm typecheck && pnpm test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat(web): integrate ErrorBoundary, OfflineBanner, ConfirmDialog, error routes"
```

---

## Task 14: Add Preview Page Sections for All New Components

**Files:**
- Modify: `apps/web/src/modules/design-system/pages/PreviewPage.tsx`

- [ ] **Step 1: Add preview sections**

Add sections to the bottom of `PreviewPage.tsx` for each new component: Sheet, Switch, ScrollArea, Collapsible, DatePicker, ErrorPages (inline 403/404/500 demos), OfflineBanner, ConfirmDialog, FormLayout, and DynamicCandidateForm.

Each section follows the existing pattern: `SectionHeader` + demo content.

Note: The Sidebar Navigation, SearchFilters, and CASL demos require their own complex sections. For the preview page, show static mockups or simplified demos — the sidebar will be integrated into the actual app layout in a future task.

- [ ] **Step 2: Run typecheck and build**

Run: `cd apps/web && pnpm typecheck && pnpm build`
Expected: PASS

- [ ] **Step 3: Visually verify at http://localhost:5173/design-system**

Run: `cd apps/web && pnpm dev`
Check that all new sections render correctly in both light and dark mode.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/modules/design-system/pages/PreviewPage.tsx
git commit -m "feat(web): add preview sections for all new design system components"
```

---

## Task 15: Final Validation

- [ ] **Step 1: Run full monorepo test suite**

Run from repo root: `pnpm test`
Expected: ALL PASS

- [ ] **Step 2: Run typecheck**

Run from repo root: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `cd apps/web && pnpm build`
Expected: BUILD SUCCESS

- [ ] **Step 4: Verify design-system page visually**

Run: `cd apps/web && pnpm dev`
Open http://localhost:5173/design-system and verify:
- All new sections render (Sheet, Switch, ScrollArea, Collapsible, DatePicker, ErrorPages, OfflineBanner, ConfirmDialog, FormLayout, DynamicForm)
- Dark mode toggle works for all sections
- All Lucide icons render correctly (no emoji fallbacks)

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore(web): final design system extensions validation"
```

---

## Dependencies & Execution Order

```
Task 0 (Prerequisites)  ──► Task 1 (RequireAuth rename)
                              │
Task 2 (Primitives) ────────►├── Task 3 (DatePicker)
                              │
Task 4 (ErrorPage) ──────────├── Task 5 (ErrorBoundary)
                              │
Task 6 (OfflineBanner) ──────├── Task 7 (QueryClient)
                              │
Task 8 (CASL Ability) ───────├── Task 9 (RoleGate/ProtectedRoute)
                              │
Task 10 (ConfirmDialog) ─────├── Task 11 (FormLayout)
                              │         │
                              │         ├── Task 12 (DynamicForm)
                              │
                              └── Task 13 (App Integration)
                                        │
                                        ├── Task 14 (Preview)
                                        │
                                        └── Task 15 (Validation)
```

**Parallel groups** (no dependencies between them):
- Tasks 2-3 (primitives) || Tasks 4-5 (errors) || Task 6 (offline) || Task 8 (CASL) || Task 10-11 (confirm+form)
- All above must complete before Task 13 (integration)
