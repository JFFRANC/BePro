import { useState } from "react";
import { useAssignments, useCreateAssignment, useDeleteAssignment } from "../hooks/useClients";
import { useUsers } from "@/modules/users/hooks/useUsers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { UserPlus, Trash2, Users } from "lucide-react";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  account_executive: "Ejecutivo de cuenta",
  recruiter: "Reclutador",
};

interface AssignmentManagerProps {
  clientId: string;
  readOnly?: boolean;
}

export function AssignmentManager({ clientId, readOnly = false }: AssignmentManagerProps) {
  const { data: assignments, isLoading } = useAssignments(clientId);
  const createAssignment = useCreateAssignment(clientId);
  const deleteAssignment = useDeleteAssignment(clientId);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedAeId, setSelectedAeId] = useState("");

  // Cargar usuarios para el selector
  const { data: usersData } = useUsers({ limit: 100, isActive: true });
  const availableUsers = usersData?.data.filter(
    (u) => !assignments?.some((a) => a.userId === u.id),
  ) ?? [];

  const handleAssign = async () => {
    if (!selectedUserId) return;
    try {
      await createAssignment.mutateAsync({
        userId: selectedUserId,
        accountExecutiveId: selectedAeId || undefined,
      });
      setSelectedUserId("");
      setSelectedAeId("");
      toast.success("Usuario asignado exitosamente");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al asignar usuario"));
    }
  };

  const handleRemove = async (assignmentId: string) => {
    try {
      await deleteAssignment.mutateAsync(assignmentId);
      toast.success("Asignación eliminada");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al eliminar asignación"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Formulario de asignación */}
      {!readOnly && (
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Usuario</label>
            <Select value={selectedUserId} onValueChange={(v) => setSelectedUserId(v ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar usuario..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} — {ROLE_LABELS[u.role] ?? u.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssign} disabled={!selectedUserId || createAssignment.isPending}>
            <UserPlus className="h-4 w-4 mr-2" />
            Asignar
          </Button>
        </div>
      )}

      {/* Tabla de asignaciones */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Ejecutivo responsable</TableHead>
              {!readOnly && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  {!readOnly && <TableCell><Skeleton className="h-8 w-8" /></TableCell>}
                </TableRow>
              ))
            ) : !assignments?.length ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 3 : 4} className="h-32 p-0">
                  <EmptyState
                    icon={Users}
                    title="Sin asignaciones"
                    description="No hay usuarios asignados a este cliente"
                  />
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.userFullName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {ROLE_LABELS[a.userRole] ?? a.userRole}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.accountExecutiveFullName ?? "—"}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(a.id)}
                        disabled={deleteAssignment.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
