// 007-candidates-module — listado role-scoped (US2 + polish UI/UX).
// - Usa SearchInput (icono + clear), TableSkeleton, EmptyState, Combobox para
//   cliente, filtro de fecha y row clickable con focus accesible.
import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useCandidatesList } from "../hooks/useCandidates";
import { useClients } from "@/modules/clients/hooks/useClients";
import { StatusBadge } from "../components/StatusBadge";
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
import { Card } from "@/components/ui/card";
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
import { UserPlus, Users, X } from "lucide-react";
import { useDebouncedValue } from "@/lib/use-debounce";

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

  return (
    <div className="page-container py-8 space-y-6">
      <PageHeader
        title="Candidatos"
        description="Lista de candidatos visibles para tu rol."
        action={
          <Link to="/candidates/new">
            <Button>
              <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
              Registrar candidato
            </Button>
          </Link>
        }
      />

      {/* KPI: count total visible (L2) — basado en items cargados; el contador
          real (server-side) se agrega cuando el endpoint exponga `total`. */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Mostrando" value={data.items.length} />
          <KpiCard
            label="Activos"
            value={data.items.filter((c) => c.is_active).length}
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
          />
          <KpiCard
            label="Contratados"
            value={
              data.items.filter((c) =>
                ["hired", "in_guarantee", "guarantee_met"].includes(c.status),
              ).length
            }
          />
        </div>
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
        <div className="min-w-44">
          <Label htmlFor="cand-updated-from">Actualizado desde</Label>
          <input
            id="cand-updated-from"
            type="date"
            value={updatedFrom}
            onChange={(e) => update("updated_from", e.target.value || null)}
            className="mt-1.5 flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
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

      {/* Active filter chips + clear-all */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          {status && (
            <FilterChip
              label={`Estado: ${statusLabel(status as CandidateStatus)}`}
              onClear={() => update("status", null)}
            />
          )}
          {clientId && (
            <FilterChip
              label={`Cliente: ${clientOptions.find((o) => o.value === clientId)?.label ?? clientId}`}
              onClear={() => update("client_id", null)}
            />
          )}
          {updatedFrom && (
            <FilterChip
              label={`Desde: ${updatedFrom}`}
              onClear={() => update("updated_from", null)}
            />
          )}
          {includeInactive && (
            <FilterChip
              label="Incluyendo desactivados"
              onClear={() => update("include_inactive", null)}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-auto"
          >
            Limpiar todo
          </Button>
        </div>
      )}

      {/* Tabla */}
      {error ? (
        <Card className="p-6 text-sm text-destructive" role="alert">
          No se pudieron cargar los candidatos. Vuelve a intentar.
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidato</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Reclutador</TableHead>
                <TableHead>Actualizado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : (data?.items.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 p-0">
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
                        ) : (
                          <Link to="/candidates/new">
                            <Button>
                              <UserPlus className="h-4 w-4 mr-2" aria-hidden="true" />
                              Registrar candidato
                            </Button>
                          </Link>
                        )
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data!.items.map((c) => (
                  <TableRow
                    key={c.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`Abrir detalle de ${c.first_name} ${c.last_name}`}
                    className="cursor-pointer transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
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

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
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
