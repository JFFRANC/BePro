// 008-ux-roles-refinements / US6 — Admin-managed custom formConfig fields.
// Renders the current `formConfig.fields[]` as a table with create / edit /
// archive-unarchive dialogs (FR-FC-001..006). `type` and `key` are immutable
// on edit — the API enforces it too. Archived fields stay in the DB for
// historical candidate values but are filtered from the candidate form.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useCreateFormConfigField,
  usePatchFormConfigField,
} from "../hooks/useClients";
import type { ICustomFormField } from "../services/clientService";
import type { IClientDetailDto } from "@bepro/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { FormInput, Plus } from "lucide-react";

const TYPE_LABELS: Record<ICustomFormField["type"], string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  checkbox: "Casilla",
  select: "Selección",
};

const FIELD_TYPES: ICustomFormField["type"][] = [
  "text",
  "number",
  "date",
  "checkbox",
  "select",
];

interface FormConfigFieldsEditorProps {
  client: IClientDetailDto;
  readOnly?: boolean;
}

interface FormConfigShape {
  fields?: ICustomFormField[];
  [k: string]: unknown;
}

type DraftField = {
  key: string;
  label: string;
  type: ICustomFormField["type"];
  required: boolean;
  optionsRaw: string; // comma-separated UI form
};

function emptyDraft(): DraftField {
  return {
    key: "",
    label: "",
    type: "text",
    required: false,
    optionsRaw: "",
  };
}

function parseOptions(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function FormConfigFieldsEditor({
  client,
  readOnly = false,
}: FormConfigFieldsEditorProps) {
  const config = (client.formConfig ?? {}) as unknown as FormConfigShape;
  const fields = useMemo(
    () => (Array.isArray(config.fields) ? config.fields : []),
    [config.fields],
  );

  const createMut = useCreateFormConfigField(client.id);
  const patchMut = usePatchFormConfigField(client.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<DraftField>(emptyDraft());
  const [editDraft, setEditDraft] = useState<DraftField | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setCreateDraft(emptyDraft());
    setError(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    setError(null);
    if (!createDraft.key || !createDraft.label) {
      setError("La clave y la etiqueta son obligatorias.");
      return;
    }
    const options =
      createDraft.type === "select" ? parseOptions(createDraft.optionsRaw) : null;
    if (createDraft.type === "select" && (!options || options.length === 0)) {
      setError("Los campos tipo 'Selección' requieren al menos una opción.");
      return;
    }
    try {
      await createMut.mutateAsync({
        key: createDraft.key,
        label: createDraft.label,
        type: createDraft.type,
        required: createDraft.required,
        options,
      });
      toast.success(`Campo '${createDraft.label}' creado`);
      setCreateOpen(false);
      setCreateDraft(emptyDraft());
    } catch (err) {
      const apiErr = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      const code = apiErr.response?.data?.error;
      if (code === "duplicate_key") {
        setError("Ya existe un campo con esa clave en este cliente.");
      } else {
        setError(apiErr.response?.data?.message ?? "No se pudo crear el campo.");
      }
    }
  }

  function openEdit(field: ICustomFormField) {
    setEditDraft({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      optionsRaw: (field.options ?? []).join(", "),
    });
    setError(null);
    setEditOpen(true);
  }

  async function handlePatch(input: {
    label?: string;
    required?: boolean;
    options?: string[] | null;
    archived?: boolean;
  }, key?: string) {
    const targetKey = key ?? editDraft?.key;
    if (!targetKey) return;
    setError(null);
    try {
      await patchMut.mutateAsync({ key: targetKey, input });
      toast.success("Campo actualizado");
      setEditOpen(false);
      setEditDraft(null);
    } catch (err) {
      const apiErr = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      setError(apiErr.response?.data?.message ?? "No se pudo actualizar el campo.");
    }
  }

  async function handleEditSave() {
    if (!editDraft) return;
    const options =
      editDraft.type === "select" ? parseOptions(editDraft.optionsRaw) : null;
    if (editDraft.type === "select" && (!options || options.length === 0)) {
      setError("Los campos tipo 'Selección' requieren al menos una opción.");
      return;
    }
    await handlePatch({
      label: editDraft.label,
      required: editDraft.required,
      options,
    });
  }

  return (
    <div className="space-y-3" data-slot="form-config-fields-editor">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Campos personalizados por cliente. Los 8 campos estándar ({""}
          <code>showAge</code>, <code>showPlant</code>, …) siguen configurándose
          en la pestaña anterior.
        </p>
        {!readOnly && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Añadir campo
          </Button>
        )}
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clave</TableHead>
              <TableHead>Etiqueta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Requerido</TableHead>
              <TableHead>Estado</TableHead>
              {!readOnly && <TableHead className="text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 5 : 6} className="h-32 p-0">
                  <EmptyState
                    icon={FormInput}
                    title="Sin campos personalizados"
                    description="Añade un campo para capturar datos específicos de este cliente."
                  />
                </TableCell>
              </TableRow>
            ) : (
              fields.map((f) => (
                <TableRow key={f.key}>
                  <TableCell>
                    <code className="text-xs">{f.key}</code>
                  </TableCell>
                  <TableCell className="font-medium">{f.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{TYPE_LABELS[f.type]}</Badge>
                  </TableCell>
                  <TableCell>{f.required ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    {f.archived ? (
                      <Badge variant="outline">Archivado</Badge>
                    ) : (
                      <Badge>Activo</Badge>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(f)}
                        disabled={patchMut.isPending}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant={f.archived ? "default" : "outline"}
                        onClick={() =>
                          handlePatch({ archived: !f.archived }, f.key)
                        }
                        disabled={patchMut.isPending}
                      >
                        {f.archived ? "Restaurar" : "Archivar"}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo campo personalizado</DialogTitle>
            <DialogDescription>
              La clave no podrá cambiar después de crear el campo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="fc-key">Clave</Label>
              <Input
                id="fc-key"
                placeholder="ej. contract_number"
                value={createDraft.key}
                onChange={(e) =>
                  setCreateDraft({ ...createDraft, key: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="fc-label">Etiqueta</Label>
              <Input
                id="fc-label"
                placeholder="ej. Número de contrato"
                value={createDraft.label}
                onChange={(e) =>
                  setCreateDraft({ ...createDraft, label: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={createDraft.type}
                onValueChange={(v) =>
                  setCreateDraft({
                    ...createDraft,
                    type: (v ?? "text") as ICustomFormField["type"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createDraft.type === "select" && (
              <div>
                <Label htmlFor="fc-options">
                  Opciones (separadas por coma)
                </Label>
                <Input
                  id="fc-options"
                  placeholder="opción A, opción B, opción C"
                  value={createDraft.optionsRaw}
                  onChange={(e) =>
                    setCreateDraft({
                      ...createDraft,
                      optionsRaw: e.target.value,
                    })
                  }
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                id="fc-required"
                checked={createDraft.required}
                onCheckedChange={(v) =>
                  setCreateDraft({
                    ...createDraft,
                    required: Boolean(v),
                  })
                }
              />
              <Label htmlFor="fc-required" className="cursor-pointer">
                Requerido
              </Label>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createMut.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              {createMut.isPending ? "Creando…" : "Crear campo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar campo</DialogTitle>
            <DialogDescription>
              La clave y el tipo no se pueden modificar.
            </DialogDescription>
          </DialogHeader>
          {editDraft && (
            <div className="space-y-3">
              <div>
                <Label>Clave</Label>
                <Input value={editDraft.key} disabled />
              </div>
              <div>
                <Label>Tipo</Label>
                <Input value={TYPE_LABELS[editDraft.type]} disabled />
              </div>
              <div>
                <Label htmlFor="fc-label-edit">Etiqueta</Label>
                <Input
                  id="fc-label-edit"
                  value={editDraft.label}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, label: e.target.value })
                  }
                />
              </div>
              {editDraft.type === "select" && (
                <div>
                  <Label htmlFor="fc-options-edit">
                    Opciones (separadas por coma)
                  </Label>
                  <Input
                    id="fc-options-edit"
                    value={editDraft.optionsRaw}
                    onChange={(e) =>
                      setEditDraft({
                        ...editDraft,
                        optionsRaw: e.target.value,
                      })
                    }
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="fc-required-edit"
                  checked={editDraft.required}
                  onCheckedChange={(v) =>
                    setEditDraft({ ...editDraft, required: Boolean(v) })
                  }
                />
                <Label htmlFor="fc-required-edit" className="cursor-pointer">
                  Requerido
                </Label>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={patchMut.isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={patchMut.isPending}>
              {patchMut.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
