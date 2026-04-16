import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUsers } from "../hooks/useUsers";
import { UserAvatar } from "./UserAvatar";
import { SearchInput } from "@/components/search-input";
import { useDebouncedValue } from "@/lib/use-debounce";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import type { IUserDto } from "@bepro/shared";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "../constants";

const ACTIVE_LABELS: Record<string, string> = {
  all: "Todos",
  true: "Activos",
  false: "Inactivos",
};

const FREELANCER_LABELS: Record<string, string> = {
  all: "Todos",
  true: "Freelancer",
  false: "Interno",
};

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          </TableCell>
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function UserList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const roleFilter = searchParams.get("role") ?? "";
  const activeFilter = searchParams.get("isActive") ?? "true";
  const freelancerFilter = searchParams.get("isFreelancer") ?? "all";

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

  const { data, isLoading } = useUsers({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    role: roleFilter || undefined,
    isActive: activeFilter === "all" ? undefined : activeFilter === "true",
    isFreelancer: freelancerFilter === "all" ? undefined : freelancerFilter === "true",
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={(v) => updateParams({ search: v, page: "1" })}
          placeholder="Buscar por nombre o email\u2026"
          className="flex-1"
        />
        <Select
          value={roleFilter || "all"}
          onValueChange={(v) => updateParams({ role: v === "all" ? "" : v ?? "", page: "1" })}
        >
          <SelectTrigger className="w-[180px]">
            {roleFilter ? ROLE_LABELS[roleFilter] : "Todos los roles"}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los roles</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="manager">Gerente</SelectItem>
            <SelectItem value="account_executive">Ejecutivo de cuenta</SelectItem>
            <SelectItem value="recruiter">Reclutador</SelectItem>
          </SelectContent>
        </Select>
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
        <Select
          value={freelancerFilter}
          onValueChange={(v) => updateParams({ isFreelancer: v ?? "all", page: "1" })}
        >
          <SelectTrigger className="w-[140px]">
            {FREELANCER_LABELS[freelancerFilter]}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Freelancer</SelectItem>
            <SelectItem value="false">Interno</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último acceso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton />
            ) : !data?.data.length ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 p-0">
                  <EmptyState
                    icon={Users}
                    title="Sin resultados"
                    description="No se encontraron usuarios con los filtros aplicados"
                  />
                </TableCell>
              </TableRow>
            ) : (
              <TooltipProvider delay={300}>
                {data.data.map((user: IUserDto) => (
                  <TableRow
                    key={user.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
                    onClick={() => navigate(`/users/${user.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/users/${user.id}`);
                      }
                    }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          firstName={user.firstName}
                          lastName={user.lastName}
                          role={user.role}
                          isActive={user.isActive}
                        />
                        <span className="font-medium">
                          {user.firstName} {user.lastName}
                        </span>
                        {user.isFreelancer && (
                          <Badge variant="outline" className="text-xs">
                            Freelancer
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_BADGE_VARIANT[user.role] ?? "secondary"}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge variant="default" className="bg-success text-success-foreground">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.lastLoginAt ? (
                        <Tooltip>
                          <TooltipTrigger>
                            {new Date(user.lastLoginAt).toLocaleDateString("es-MX")}
                          </TooltipTrigger>
                          <TooltipContent>
                            {new Date(user.lastLoginAt).toLocaleString("es-MX")}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="italic">Sin acceso registrado</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TooltipProvider>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
            {data.pagination.total} usuario{data.pagination.total !== 1 ? "s" : ""} en total
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
