import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPositionSchema, type CreatePositionFormValues } from "@bepro/shared";
import { usePositions, useCreatePosition, useUpdatePosition, useDeletePosition } from "../hooks/useClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, Check, X, Briefcase } from "lucide-react";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import type { IClientPositionDto } from "@bepro/shared";

interface PositionListProps {
  clientId: string;
  readOnly?: boolean;
}

export function PositionList({ clientId, readOnly = false }: PositionListProps) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: positions, isLoading } = usePositions(clientId, includeInactive);
  const deletePosition = useDeletePosition(clientId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="includeInactive"
            checked={includeInactive}
            onCheckedChange={setIncludeInactive}
          />
          <Label htmlFor="includeInactive" className="text-sm cursor-pointer">
            Mostrar inactivos
          </Label>
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar puesto
          </Button>
        )}
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Puesto</TableHead>
              <TableHead>Estado</TableHead>
              {!readOnly && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {showAddForm && (
              <AddPositionRow
                clientId={clientId}
                onSave={() => setShowAddForm(false)}
                onCancel={() => setShowAddForm(false)}
              />
            )}
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  {!readOnly && <TableCell><Skeleton className="h-8 w-16" /></TableCell>}
                </TableRow>
              ))
            ) : !positions?.length && !showAddForm ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 2 : 3} className="h-32 p-0">
                  <EmptyState
                    icon={Briefcase}
                    title="Sin puestos"
                    description="No hay puestos registrados para este cliente"
                  />
                </TableCell>
              </TableRow>
            ) : (
              positions?.map((position) =>
                editingId === position.id ? (
                  <EditPositionRow
                    key={position.id}
                    position={position}
                    clientId={clientId}
                    onSave={() => setEditingId(null)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <TableRow key={position.id}>
                    <TableCell className="font-medium">{position.name}</TableCell>
                    <TableCell>
                      {position.isActive ? (
                        <Badge variant="default" className="bg-success text-success-foreground">Activo</Badge>
                      ) : (
                        <Badge variant="secondary">Inactivo</Badge>
                      )}
                    </TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditingId(position.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              try {
                                await deletePosition.mutateAsync(position.id);
                                toast.success("Puesto eliminado");
                              } catch (err) {
                                toast.error(getApiErrorMessage(err, "Error al eliminar puesto"));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AddPositionRow({
  clientId,
  onSave,
  onCancel,
}: {
  clientId: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const createPosition = useCreatePosition(clientId);
  const { register, handleSubmit, formState: { errors } } = useForm<CreatePositionFormValues>({
    resolver: zodResolver(createPositionSchema),
  });

  const onSubmit = async (data: CreatePositionFormValues) => {
    try {
      await createPosition.mutateAsync(data);
      toast.success("Puesto creado");
      onSave();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al crear puesto"));
    }
  };

  return (
    <TableRow>
      <TableCell colSpan={2}>
        <Input placeholder="Nombre del puesto" {...register("name")} error={!!errors.name} className="h-8" />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleSubmit(onSubmit)} disabled={createPosition.isPending}>
            <Check className="h-4 w-4 text-success" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EditPositionRow({
  position,
  clientId,
  onSave,
  onCancel,
}: {
  position: IClientPositionDto;
  clientId: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const updatePosition = useUpdatePosition(clientId);
  const { register, handleSubmit } = useForm<CreatePositionFormValues>({
    resolver: zodResolver(createPositionSchema),
    defaultValues: { name: position.name },
  });

  const onSubmit = async (data: CreatePositionFormValues) => {
    try {
      await updatePosition.mutateAsync({ positionId: position.id, data });
      toast.success("Puesto actualizado");
      onSave();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al actualizar puesto"));
    }
  };

  return (
    <TableRow>
      <TableCell colSpan={2}>
        <Input {...register("name")} className="h-8" />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleSubmit(onSubmit)} disabled={updatePosition.isPending}>
            <Check className="h-4 w-4 text-success" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
