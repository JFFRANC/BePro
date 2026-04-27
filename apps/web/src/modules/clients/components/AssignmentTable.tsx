// 008-ux-roles-refinements / US5 — tabla polimórfica (AE + reclutadores).
//
// Renderiza dos secciones separadas (Ejecutivos de cuenta, Reclutadores) con
// checkbox por fila. Cada fila de reclutador expone un selector de "líder (AE)"
// cuyas opciones son los AEs actualmente seleccionados (reactividad viva: si el
// usuario desmarca un AE, cualquier reclutador cuyo líder apuntaba allí vuelve
// a "Sin líder"). "Guardar" envía el diff completo como
// { accountExecutives, recruiters:[{userId, accountExecutiveId?}] } en una
// única llamada (FR-AS-001..005). El componente es admin-only por upstream.
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Users, UserRoundCheck } from "lucide-react";
import { useAssignments, useBatchAssignClient } from "../hooks/useClients";
import { useUsers } from "@/modules/users/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { getApiErrorMessage } from "@/lib/error-utils";
import type { IBatchAssignmentsRequest } from "../services/clientService";

interface AssignmentTableProps {
  clientId: string;
  readOnly?: boolean;
}

// Razones del backend → copy en español para la fila ofensora.
const OFFENDER_REASON_COPY: Record<string, string> = {
  not_in_tenant: "Usuario no encontrado",
  inactive: "Usuario inactivo",
  invalid_role: "Rol inválido",
  leader_not_in_set: "Líder (AE) no seleccionado en esta pantalla",
  leader_role_mismatch: "Líder seleccionado no es un AE",
};

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface ApiError {
  response?: {
    data?: {
      error?: string;
      message?: string;
      offenders?: { userId: string; reason: string }[];
    };
  };
}

export function AssignmentTable({
  clientId,
  readOnly = false,
}: AssignmentTableProps) {
  const { data: assignments, isLoading: assignmentsLoading } =
    useAssignments(clientId);
  const { data: usersData, isLoading: usersLoading } = useUsers({
    limit: 100,
    isActive: true,
  });
  const batchAssign = useBatchAssignClient(clientId);

  // Usuarios activos partidos por rol. Admin/manager se ignoran — no son
  // elegibles para asignación a clientes.
  const allUsers = useMemo<UserRow[]>(
    () => (usersData?.data ?? []).filter((u) => u.isActive),
    [usersData],
  );
  const allAes = useMemo(
    () => allUsers.filter((u) => u.role === "account_executive"),
    [allUsers],
  );
  const allRecruiters = useMemo(
    () => allUsers.filter((u) => u.role === "recruiter"),
    [allUsers],
  );

  // Estado servidor derivado: set de AE ids asignados + map reclutador→líder.
  const serverAeIds = useMemo(
    () =>
      new Set(
        (assignments ?? [])
          .filter((a) => a.userRole === "account_executive")
          .map((a) => a.userId),
      ),
    [assignments],
  );
  const serverRecruiterLeader = useMemo(() => {
    const m = new Map<string, string | undefined>();
    for (const a of assignments ?? []) {
      if (a.userRole === "recruiter") {
        m.set(a.userId, a.accountExecutiveId ?? undefined);
      }
    }
    return m;
  }, [assignments]);

  // --- Estado local editable ---
  const [selectedAeIds, setSelectedAeIds] = useState<Set<string>>(new Set());
  const [selectedRecruiterIds, setSelectedRecruiterIds] = useState<Set<string>>(
    new Set(),
  );
  // Leader por reclutador — undefined significa "Sin líder".
  const [recruiterLeaders, setRecruiterLeaders] = useState<
    Map<string, string | undefined>
  >(new Map());
  const [search, setSearch] = useState("");
  // Errores por userId devueltos por el backend tras un intento de guardado.
  const [offendersByUser, setOffendersByUser] = useState<Map<string, string>>(
    new Map(),
  );
  const containerRef = useRef<HTMLDivElement>(null);

  // Seed desde el servidor cuando llegan los datos o cambian.
  useEffect(() => {
    setSelectedAeIds(new Set(serverAeIds));
    setSelectedRecruiterIds(new Set(serverRecruiterLeader.keys()));
    setRecruiterLeaders(new Map(serverRecruiterLeader));
    setOffendersByUser(new Map());
  }, [serverAeIds, serverRecruiterLeader]);

  // Tras un 422, mover el foco al primer renglón ofensor para que la lectura por
  // teclado/lectores de pantalla aterrice donde está el problema.
  useEffect(() => {
    if (offendersByUser.size === 0) return;
    const firstId = offendersByUser.keys().next().value;
    if (!firstId) return;
    const row = containerRef.current?.querySelector<HTMLElement>(
      `[data-testid$="${firstId}"]`,
    );
    if (row) {
      row.setAttribute("tabindex", "-1");
      row.focus({ preventScroll: false });
    }
  }, [offendersByUser]);

  // --- Búsqueda (filtra ambas secciones) ---
  const filterBySearch = (list: UserRow[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  };
  const visibleAes = useMemo(() => filterBySearch(allAes), [allAes, search]);
  const visibleRecruiters = useMemo(
    () => filterBySearch(allRecruiters),
    [allRecruiters, search],
  );

  // --- Diff ---
  // El líder EFECTIVO de un reclutador marcado es su leader solo si ese AE
  // sigue marcado; de lo contrario se colapsa a undefined (Sin líder).
  const effectiveLeader = (recruiterId: string): string | undefined => {
    if (!selectedRecruiterIds.has(recruiterId)) return undefined;
    const leader = recruiterLeaders.get(recruiterId);
    if (!leader) return undefined;
    return selectedAeIds.has(leader) ? leader : undefined;
  };

  const hasChanges = useMemo(() => {
    // 1) Diferencia en conjunto de AEs.
    if (selectedAeIds.size !== serverAeIds.size) return true;
    for (const id of selectedAeIds) if (!serverAeIds.has(id)) return true;

    // 2) Diferencia en conjunto de reclutadores.
    if (selectedRecruiterIds.size !== serverRecruiterLeader.size) return true;
    for (const id of selectedRecruiterIds)
      if (!serverRecruiterLeader.has(id)) return true;

    // 3) Diferencia en líder (comparar líder EFECTIVO vs servidor).
    for (const id of selectedRecruiterIds) {
      const desired = effectiveLeader(id);
      const current = serverRecruiterLeader.get(id) ?? undefined;
      if (desired !== current) return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAeIds,
    selectedRecruiterIds,
    recruiterLeaders,
    serverAeIds,
    serverRecruiterLeader,
  ]);

  // --- Handlers ---
  function toggleAe(userId: string) {
    setSelectedAeIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }
  function toggleRecruiter(userId: string) {
    setSelectedRecruiterIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }
  function setLeader(recruiterId: string, leaderId: string | undefined) {
    setRecruiterLeaders((prev) => {
      const next = new Map(prev);
      if (leaderId) next.set(recruiterId, leaderId);
      else next.set(recruiterId, undefined);
      return next;
    });
  }

  async function handleSave() {
    setOffendersByUser(new Map());
    const payload: IBatchAssignmentsRequest = {
      accountExecutives: Array.from(selectedAeIds),
      recruiters: Array.from(selectedRecruiterIds).map((userId) => {
        const leader = effectiveLeader(userId);
        return leader ? { userId, accountExecutiveId: leader } : { userId };
      }),
    };

    try {
      const result = await batchAssign.mutateAsync(payload);
      const added = result.added.length;
      const removed = result.removed.length;
      const reparented = result.reparented.length;
      // Si no hubo re-asignaciones, omitimos el sufijo para evitar ruido visual.
      const summary =
        reparented > 0
          ? `Asignaciones actualizadas — ${added} agregadas, ${removed} removidas, ${reparented} re-asignadas`
          : `Asignaciones actualizadas — ${added} agregadas, ${removed} removidas`;
      toast.success(summary);
    } catch (err) {
      const apiErr = err as ApiError;
      const offenders = apiErr.response?.data?.offenders ?? [];
      if (offenders.length > 0) {
        const next = new Map<string, string>();
        for (const o of offenders) {
          next.set(
            o.userId,
            OFFENDER_REASON_COPY[o.reason] ?? "Error de validación",
          );
        }
        setOffendersByUser(next);
      }
      const message =
        apiErr.response?.data?.message ??
        getApiErrorMessage(err, "No se pudo guardar el cambio.");
      toast.error(message);
    }
  }

  function handleReset() {
    setSelectedAeIds(new Set(serverAeIds));
    setSelectedRecruiterIds(new Set(serverRecruiterLeader.keys()));
    setRecruiterLeaders(new Map(serverRecruiterLeader));
    setOffendersByUser(new Map());
  }

  const isLoading = assignmentsLoading || usersLoading;

  // --- Render helpers ---
  const selectedAesAsArray = useMemo(
    () =>
      allAes
        .filter((u) => selectedAeIds.has(u.id))
        .map((u) => ({ id: u.id, label: `${u.firstName} ${u.lastName}` })),
    [allAes, selectedAeIds],
  );

  return (
    <div
      className="space-y-6 pb-20"
      data-slot="assignment-table"
      ref={containerRef}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Input
          placeholder="Buscar por nombre o correo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
          aria-label="Buscar por nombre o correo"
          autoComplete="off"
          spellCheck={false}
          type="search"
        />
        <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
          Solo se muestran usuarios activos con rol AE o Reclutador.
        </p>
      </div>

      {/* --- Sección: Ejecutivos de cuenta --- */}
      <section aria-labelledby="assignment-ae-heading" className="space-y-2">
        <h3
          id="assignment-ae-heading"
          className="text-sm font-semibold text-foreground"
        >
          Ejecutivos de cuenta
        </h3>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!readOnly && <TableHead className="w-10" aria-label="Asignar" />}
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    {!readOnly && (
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                    )}
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visibleAes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 3 : 4}
                    className="h-32 p-0"
                  >
                    <EmptyState
                      icon={UserRoundCheck}
                      title="Sin ejecutivos de cuenta"
                      description={
                        allAes.length === 0
                          ? "Crea usuarios con rol 'account_executive' para poder asignarlos a este cliente."
                          : "Ningún ejecutivo coincide con la búsqueda."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleAes.map((u) => {
                  const isSelected = selectedAeIds.has(u.id);
                  const wasAssigned = serverAeIds.has(u.id);
                  const isModified = isSelected !== wasAssigned;
                  const offenderMsg = offendersByUser.get(u.id);
                  return (
                    <TableRow
                      key={u.id}
                      data-testid={`ae-row-${u.id}`}
                      className="hover:bg-muted/30"
                    >
                      {!readOnly && (
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleAe(u.id)}
                            aria-label={`Asignar a ${u.firstName} ${u.lastName}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium min-w-0 max-w-[20rem]">
                        <div className="flex items-center gap-1.5">
                          {isModified && (
                            <span
                              className="size-1.5 rounded-full bg-warning shrink-0"
                              aria-label="Cambio sin guardar"
                              title="Cambio sin guardar"
                            />
                          )}
                          <span className="truncate">
                            {u.firstName} {u.lastName}
                          </span>
                        </div>
                        {offenderMsg && (
                          <div
                            className="text-xs text-destructive mt-1"
                            aria-live="polite"
                          >
                            {offenderMsg}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground min-w-0 max-w-[16rem]">
                        <span className="truncate block">{u.email}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {wasAssigned ? "Asignado" : "No asignado"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* --- Sección: Reclutadores --- */}
      <section
        aria-labelledby="assignment-recruiter-heading"
        className="space-y-2"
      >
        <h3
          id="assignment-recruiter-heading"
          className="text-sm font-semibold text-foreground"
        >
          Reclutadores
        </h3>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {!readOnly && <TableHead className="w-10" aria-label="Asignar" />}
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Líder (AE)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    {!readOnly && (
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                    )}
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visibleRecruiters.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={readOnly ? 3 : 4}
                    className="h-32 p-0"
                  >
                    <EmptyState
                      icon={Users}
                      title="Sin reclutadores"
                      description={
                        allRecruiters.length === 0
                          ? "Crea usuarios con rol 'recruiter' para poder asignarlos a este cliente."
                          : "Ningún reclutador coincide con la búsqueda."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visibleRecruiters.map((u) => {
                  const isSelected = selectedRecruiterIds.has(u.id);
                  const wasAssigned = serverRecruiterLeader.has(u.id);
                  const desiredLeader = effectiveLeader(u.id);
                  const serverLeader = serverRecruiterLeader.get(u.id) ?? undefined;
                  const isModified =
                    isSelected !== wasAssigned ||
                    (isSelected && desiredLeader !== serverLeader);
                  const offenderMsg = offendersByUser.get(u.id);
                  // Valor visible del select: si el líder almacenado ya no
                  // está en el set de AEs seleccionados, mostramos "".
                  const rawLeader = recruiterLeaders.get(u.id);
                  const visibleLeader =
                    rawLeader && selectedAeIds.has(rawLeader) ? rawLeader : "";
                  return (
                    <TableRow
                      key={u.id}
                      data-testid={`recruiter-row-${u.id}`}
                      className="hover:bg-muted/30"
                    >
                      {!readOnly && (
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRecruiter(u.id)}
                            aria-label={`Asignar a ${u.firstName} ${u.lastName}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium min-w-0 max-w-[20rem]">
                        <div className="flex items-center gap-1.5">
                          {isModified && (
                            <span
                              className="size-1.5 rounded-full bg-warning shrink-0"
                              aria-label="Cambio sin guardar"
                              title="Cambio sin guardar"
                            />
                          )}
                          <span className="truncate">
                            {u.firstName} {u.lastName}
                          </span>
                        </div>
                        {offenderMsg && (
                          <div
                            className="text-xs text-destructive mt-1"
                            aria-live="polite"
                          >
                            {offenderMsg}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground min-w-0 max-w-[16rem]">
                        <span className="truncate block">{u.email}</span>
                      </TableCell>
                      <TableCell>
                        {isSelected ? (
                          <select
                            className="h-8 rounded-md border border-input bg-background text-foreground px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [touch-action:manipulation]"
                            aria-label={`Líder (AE) de ${u.firstName} ${u.lastName}`}
                            value={visibleLeader}
                            onChange={(e) =>
                              setLeader(u.id, e.target.value || undefined)
                            }
                            disabled={readOnly}
                          >
                            <option value="">Sin líder</option>
                            {selectedAesAsArray.map((ae) => (
                              <option key={ae.id} value={ae.id}>
                                {ae.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Barra de guardado pegajosa — siempre montada (los tests verifican
          que los botones existan aun sin cambios) pero solo visible cuando
          el rol permite editar. */}
      {!readOnly && (
        <div
          className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70"
          aria-live="polite"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <p className="text-sm text-muted-foreground">
              {hasChanges
                ? "Tienes cambios sin guardar."
                : "Sin cambios pendientes."}
            </p>
            <div className="flex items-center gap-2 sm:ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges || batchAssign.isPending}
              >
                Restablecer
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!hasChanges || batchAssign.isPending}
              >
                {batchAssign.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
