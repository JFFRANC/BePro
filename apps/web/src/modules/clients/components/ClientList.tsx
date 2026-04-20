import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClients } from "../hooks/useClients";
import { SearchInput } from "@/components/search-input";
import { useDebouncedValue } from "@/lib/use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import type { IClientDto } from "@bepro/shared";

const ACTIVE_LABELS: Record<string, string> = {
  all: "Todos",
  true: "Activos",
  false: "Inactivos",
};

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function ClientList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const activeFilter = searchParams.get("isActive") ?? "true";

  const debouncedSearch = useDebouncedValue(search, 300);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(updates)) {
          if (!value || value === "all" || (key === "isActive" && value === "true") || (key === "page" && value === "1")) {
            next.delete(key);
          } else {
            next.set(key, value);
          }
        }
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const { data, isLoading } = useClients({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: activeFilter === "all" ? undefined : activeFilter === "true",
  });

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={(v) => updateParams({ search: v, page: "1" })}
          placeholder="Buscar por nombre de empresa..."
          className="flex-1"
        />
        <Select
          value={activeFilter}
          onValueChange={(v) => updateParams({ isActive: v ?? "all", page: "1" })}
        >
          <SelectTrigger className="w-[140px]">
            {ACTIVE_LABELS[activeFilter]}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Activos</SelectItem>
            <SelectItem value="false">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : !data?.data.length ? (
              <TableRow>
                <TableCell colSpan={3} className="h-48 p-0">
                  <EmptyState
                    icon={Building2}
                    title="Sin resultados"
                    description="No se encontraron clientes con los filtros aplicados"
                  />
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((client: IClientDto) => (
                <TableRow
                  key={client.id}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                  onClick={() => navigate(`/clients/${client.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/clients/${client.id}`);
                    }
                  }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Building2 className="size-4" />
                      </div>
                      <span className="font-medium">{client.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.address || <span className="italic">—</span>}
                  </TableCell>
                  <TableCell>
                    {client.isActive ? (
                      <Badge variant="default" className="bg-success text-success-foreground">
                        Activo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inactivo</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
            {data.pagination.total} cliente{data.pagination.total !== 1 ? "s" : ""} en total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="Página anterior"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="text-sm text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
              Página {page} de {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Página siguiente"
              disabled={page >= data.pagination.totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
