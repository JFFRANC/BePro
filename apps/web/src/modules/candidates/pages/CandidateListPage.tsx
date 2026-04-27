// 007-candidates-module — listado role-scoped (US2 + polish UI/UX).
// - Usa SearchInput (icono + clear), TableSkeleton, EmptyState, Combobox para
//   cliente, filtro de fecha y row clickable con focus accesible.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCandidatesList } from "../hooks/useCandidates";
import { useAppAbility } from "@/components/ability-provider";
import { useClients } from "@/modules/clients/hooks/useClients";
import { StatusBadge } from "../components/StatusBadge";
import { InlineStatusMenu } from "../components/InlineStatusMenu";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/search-input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CardGrid } from "@/components/motion/CardGrid";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/combobox";
import {
  CANDIDATE_STATUSES,
  statusLabel,
  type CandidateStatus,
} from "@bepro/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, UserPlus, Users, X } from "lucide-react";
import { useDebouncedValue } from "@/lib/use-debounce";
import { DatePicker } from "@/components/date-picker";
import { useAutoAnimate } from "@/components/motion";

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-28 ml-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function CandidateListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? "";
  const debouncedQ = useDebouncedValue(q, 250);
  const status = params.get("status") ?? "";
  const clientId = params.get("client_id") ?? "";
  const updatedFrom = params.get("updated_from") ?? "";
  const includeInactive = params.get("include_inactive") === "true";
  const cursor = params.get("cursor") ?? undefined;

  // Lista de clientes activos para el filtro Combobox.
  const clientsQuery = useClients({ page: 1, limit: 100, isActive: true });
  const clientOptions = useMemo(
    () =>
      (clientsQuery.data?.data ?? []).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [clientsQuery.data],
  );

  const queryParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      status: status ? [status] : undefined,
      client_id: clientId ? [clientId] : undefined,
      updated_from: updatedFrom || undefined,
      include_inactive: includeInactive,
      cursor,
      limit: 25,
    }),
    [debouncedQ, status, clientId, updatedFrom, includeInactive, cursor],
  );

  const { data, isLoading, error } = useCandidatesList(queryParams);
  // 008-ux-roles-refinements / US2 (FR-CG-002) — hide "Registrar candidato"
  // entry points unless the viewer has ability.create Candidate (recruiter-only).
  const ability = useAppAbility();
  const canCreateCandidate = ability.can("create", "Candidate");

  function update(field: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null || value === "") {
      next.delete(field);
    } else {
      next.set(field, value);
    }
    next.delete("cursor");
    setParams(next, { replace: true });
  }

  function clearAll() {
    const next = new URLSearchParams();
    setParams(next, { replace: true });
  }

  const canToggleInactive = user?.role === "manager" || user?.role === "admin";
  const hasActiveFilters = Boolean(
    q || status || clientId || updatedFrom || includeInactive || cursor,
  );

  // Client-side sorting state (W2) — feature 009 follow-up.
  // Sort keys mapean a las columnas visibles. El orden visual en la tabla
  // respeta este state localmente hasta que el endpoint exponga sort.
  const [sortKey, setSortKey] = useState<
    "name" | "client" | "status" | "recruiter" | "updated"
  >("updated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortDirectionFor(key: typeof sortKey): "asc" | "desc" | false {
    return sortKey === key ? sortDir : false;
  }

  const sortedItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!items.length) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      let av = "";
      let bv = "";
      switch (sortKey) {
        case "name":
          av = `${a.first_name} ${a.last_name}`.toLowerCase();
          bv = `${b.first_name} ${b.last_name}`.toLowerCase();
          break;
        case "client":
          av = a.client.name.toLowerCase();
          bv = b.client.name.toLowerCase();
          break;
        case "status":
          av = a.status;
          bv = b.status;
          break;
        case "recruiter":
          av = a.registering_user.display_name.toLowerCase();
          bv = b.registering_user.display_name.toLowerCase();
          break;
        case "updated":
          av = a.updated_at;
          bv = b.updated_at;
          break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data?.items, sortKey, sortDir]);

  // Auto-animate ref para la fila de filter chips (add/remove suave).
  const [chipRowRef] = useAutoAnimate();

  return (
    <div className="page-container py-8 space-y-6">
      <PageHeader
        title="Candidatos"
        description="Lista de candidatos visibles para tu rol."
        action={
          canCreateCandidate ? (
            <Link to="/candidates/new">
              <Button>
                <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
                Registrar candidato
              </Button>
            </Link>
          ) : undefined
        }
      />

      {/* KPI: count total visible (L2) — basado en items cargados; el contador
          real (server-side) se agrega cuando el endpoint exponga `total`.
          Feature 009 follow-up: CardGrid aplica stagger de entrada (40ms) y cada
          KpiCard usa variant=accent + interactive para hover lift y stripe. */}
      {data && (
        <CardGrid className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Mostrando"
            value={data.items.length}
            accentColor="border-t-primary"
          />
          <KpiCard
            label="Activos"
            value={data.items.filter((c) => c.is_active).length}
            accentColor="border-t-success"
          />
          <KpiCard
            label="En proceso"
            value={
              data.items.filter((c) =>
                ["interview_scheduled", "attended", "pending", "approved"].includes(
                  c.status,
                ),
              ).length
            }
            accentColor="border-t-warning"
          />
          <KpiCard
            label="Contratados"
            value={
              data.items.filter((c) =>
                ["hired", "in_guarantee", "guarantee_met"].includes(c.status),
              ).length
            }
            accentColor="border-t-info"
          />
        </CardGrid>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex-1 min-w-60">
          <Label htmlFor="cand-search">Buscar</Label>
          <div className="mt-1.5">
            <SearchInput
              value={q}
              onChange={(v) => update("q", v)}
              placeholder="Nombre, correo o teléfono…"
            />
          </div>
        </div>
        <div className="min-w-48">
          <Label htmlFor="cand-status">Estado</Label>
          <Select
            value={status || "all"}
            onValueChange={(v) => update("status", v === "all" ? null : v)}
          >
            <SelectTrigger id="cand-status" className="mt-1.5">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {CANDIDATE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s as CandidateStatus)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-56">
          <Label>Cliente</Label>
          <div className="mt-1.5">
            <Combobox
              options={clientOptions}
              value={clientId || undefined}
              onValueChange={(v) => update("client_id", v || null)}
              placeholder="Todos los clientes"
              searchPlaceholder="Buscar cliente…"
              emptyMessage="Sin coincidencias"
            />
          </div>
        </div>
        <div className="min-w-48">
          <Label>Actualizado desde</Label>
          <div className="mt-1.5">
            <DatePicker
              value={
                updatedFrom ? new Date(`${updatedFrom}T00:00:00`) : undefined
              }
              onChange={(d) =>
                update(
                  "updated_from",
                  d ? d.toISOString().slice(0, 10) : null,
                )
              }
              placeholder="Cualquier fecha"
            />
          </div>
        </div>
        {canToggleInactive ? (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none h-8">
            <Checkbox
              checked={includeInactive}
              onCheckedChange={(v) =>
                update("include_inactive", v ? "true" : null)
              }
            />
            Incluir desactivados
          </label>
        ) : null}
      </div>

      {/* Active filter chips + clear-all — feature 009 follow-up.
          useAutoAnimate anima add/remove de chips con un FLIP suave. */}
      {hasActiveFilters && (
        <div
          ref={chipRowRef}
          className="flex flex-wrap items-center gap-2"
        >
          {status && (
            <FilterChip
              key="status"
              label={`Estado: ${statusLabel(status as CandidateStatus)}`}
              onClear={() => update("status", null)}
            />
          )}
          {clientId && (
            <FilterChip
              key="client"
              label={`Cliente: ${clientOptions.find((o) => o.value === clientId)?.label ?? clientId}`}
              onClear={() => update("client_id", null)}
            />
          )}
          {updatedFrom && (
            <FilterChip
              key="from"
              label={`Desde: ${updatedFrom}`}
              onClear={() => update("updated_from", null)}
            />
          )}
          {includeInactive && (
            <FilterChip
              key="inactive"
              label="Incluyendo desactivados"
              onClear={() => update("include_inactive", null)}
            />
          )}
          <button
            key="clear-all"
            type="button"
            onClick={clearAll}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 text-xs font-medium text-destructive transition-colors duration-150 ease-out hover:bg-destructive/10 hover:border-destructive/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            <X className="size-3" aria-hidden="true" />
            Limpiar todo
          </button>
        </div>
      )}

      {/* Tabla */}
      {error ? (
        <Card
          variant="outline"
          className="border-destructive/40 bg-destructive/5"
          role="alert"
        >
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md bg-destructive/10 p-2 text-destructive">
                <AlertCircle className="size-4" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-destructive">
                  No se pudieron cargar los candidatos
                </CardTitle>
                <CardDescription className="mt-1">
                  Revisa tu conexion e intenta recargar la pagina. Si el
                  problema persiste, contacta a soporte.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  sortable
                  sortDirection={sortDirectionFor("name")}
                  onSort={() => toggleSort("name")}
                >
                  Candidato
                </TableHead>
                <TableHead
                  sortable
                  sortDirection={sortDirectionFor("client")}
                  onSort={() => toggleSort("client")}
                >
                  Cliente
                </TableHead>
                <TableHead
                  sortable
                  sortDirection={sortDirectionFor("status")}
                  onSort={() => toggleSort("status")}
                >
                  Estado
                </TableHead>
                <TableHead
                  sortable
                  sortDirection={sortDirectionFor("recruiter")}
                  onSort={() => toggleSort("recruiter")}
                >
                  Reclutador
                </TableHead>
                <TableHead
                  sortable
                  sortDirection={sortDirectionFor("updated")}
                  onSort={() => toggleSort("updated")}
                >
                  Actualizado
                </TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : sortedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 p-0">
                    <EmptyState
                      icon={Users}
                      title="No hay candidatos en tu alcance"
                      description={
                        hasActiveFilters
                          ? "Prueba con otros filtros o limpia la búsqueda."
                          : "Empieza registrando un candidato para este tenant."
                      }
                      action={
                        hasActiveFilters ? (
                          <Button variant="outline" onClick={clearAll}>
                            Limpiar filtros
                          </Button>
                        ) : canCreateCandidate ? (
                          <Link to="/candidates/new">
                            <Button>
                              <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
                              Registrar candidato
                            </Button>
                          </Link>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                sortedItems.map((c) => (
                  <TableRow
                    key={c.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Abrir detalle de ${c.first_name} ${c.last_name}`}
                    className="cursor-pointer focus-visible:outline-none"
                    onClick={() => navigate(`/candidates/${c.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/candidates/${c.id}`);
                      }
                    }}
                  >
                    <TableCell>
                      <span className="font-medium">
                        {c.first_name} {c.last_name}
                      </span>
                    </TableCell>
                    <TableCell>{c.client.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell>{c.registering_user.display_name}</TableCell>
                    <TableCell
                      className="text-muted-foreground whitespace-nowrap"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {new Date(c.updated_at).toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* 008 US3 (FR-ST-001..006) — per-row inline transition. */}
                      <InlineStatusMenu
                        candidateId={c.id}
                        currentStatus={c.status}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Paginación */}
      {data?.next_cursor ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => update("cursor", data.next_cursor!)}
          >
            Cargar más
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// Feature 009 follow-up: KpiCard ahora delega al primitive Card con
// variant=accent + stripe color + interactive. El count-up usa el mismo
// hook que StatCard para animar el valor (respeta prefers-reduced-motion).
function useCountUpValue(target: number): number {
  const [display, setDisplay] = useState<number>(target);
  const prevRef = useRef<number>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || prev === target) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    const duration = 500;
    const from = prev;
    const delta = target - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return display;
}

function KpiCard({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: number;
  accentColor: string;
}) {
  const display = useCountUpValue(value);
  return (
    <Card variant="accent" accentColor={accentColor} interactive size="sm">
      <CardHeader>
        <CardDescription className="text-xs uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle className="!text-3xl font-bold font-heading tabular-nums">
          {display}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

function FilterChip({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <Badge variant="outline" className="gap-1.5 pl-2 pr-1 h-7 text-xs">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Quitar filtro ${label}`}
        className="rounded-full p-0.5 hover:bg-muted-foreground/10 transition-colors"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </Badge>
  );
}
