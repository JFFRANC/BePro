// 007-candidates-module — admin CRUD de categorías (US5) con confirm + inline rename.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useConfirm } from "@/components/confirm-dialog";
import { Pencil, Check, X } from "lucide-react";
import {
  useRejectionCategories,
  useDeclineCategories,
} from "../hooks/useCandidates";
import {
  createDeclineCategory,
  createRejectionCategory,
  updateDeclineCategory,
  updateRejectionCategory,
  type CategoryDto,
} from "../services/candidateApi";

function CategoryBlock({
  title,
  kind,
  query,
  createFn,
  updateFn,
}: {
  title: string;
  kind: "rejection" | "decline";
  query: ReturnType<typeof useRejectionCategories>;
  createFn: (label: string) => Promise<CategoryDto>;
  updateFn: (id: string, body: { is_active?: boolean; label?: string }) => Promise<CategoryDto>;
}) {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const queryKey = ["candidates", "categories", kind];
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const create = useMutation({
    mutationFn: () => createFn(newLabel.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNewLabel("");
      toast.success("Categoría creada.");
    },
    onError: (err) => {
      const r = (err as { response?: { data?: { message?: string } } }).response;
      toast.error(r?.data?.message ?? "No se pudo crear la categoría.");
    },
  });

  const renameMutation = useMutation({
    mutationFn: (params: { id: string; label: string }) =>
      updateFn(params.id, { label: params.label }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setEditingLabel("");
      toast.success("Categoría renombrada.");
    },
    onError: () => toast.error("No se pudo renombrar."),
  });

  const toggleMutation = useMutation({
    mutationFn: (params: { id: string; is_active: boolean }) =>
      updateFn(params.id, { is_active: params.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error("No se pudo actualizar."),
  });

  async function handleToggle(category: CategoryDto, next: boolean) {
    if (!next) {
      const ok = await confirm({
        title: `Desactivar "${category.label}"`,
        description:
          "Esta categoría dejará de aparecer en transiciones futuras. Los registros históricos conservan su etiqueta original (FR-051).",
        confirmLabel: "Desactivar",
        variant: "destructive",
      });
      if (!ok) return;
    }
    toggleMutation.mutate({ id: category.id, is_active: next });
  }

  function startRename(category: CategoryDto) {
    setEditingId(category.id);
    setEditingLabel(category.label);
  }

  function cancelRename() {
    setEditingId(null);
    setEditingLabel("");
  }

  function commitRename(id: string) {
    if (!editingLabel.trim()) return;
    renameMutation.mutate({ id, label: editingLabel.trim() });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newLabel.trim()) create.mutate();
          }}
        >
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nueva categoría…"
            maxLength={100}
            aria-label={`Nueva categoría de ${kind === "rejection" ? "rechazo" : "declinación"}`}
          />
          <Button
            type="submit"
            disabled={!newLabel.trim() || create.isPending}
          >
            Agregar
          </Button>
        </form>
        {(query.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Sin categorías aún. Crea la primera arriba.
          </p>
        ) : (
          <ul className="space-y-2">
            {(query.data ?? []).map((c) => {
              const isEditing = editingId === c.id;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent/30"
                >
                  {isEditing ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitRename(c.id);
                      }}
                    >
                      <Input
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        autoFocus
                        maxLength={100}
                        aria-label="Nuevo nombre"
                        className="h-8"
                      />
                      <Button
                        type="submit"
                        size="icon-sm"
                        disabled={
                          !editingLabel.trim() || renameMutation.isPending
                        }
                        aria-label="Guardar"
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={cancelRename}
                        aria-label="Cancelar"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <span className="flex items-center gap-2">
                        {c.label}
                        {!c.is_active && (
                          <Badge variant="outline">Inactivo</Badge>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startRename(c)}
                          aria-label={`Renombrar ${c.label}`}
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={(v) => handleToggle(c, Boolean(v))}
                          aria-label={c.is_active ? "Desactivar" : "Activar"}
                        />
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function CategoryAdminPage() {
  const { user } = useAuth();
  const rejection = useRejectionCategories();
  const decline = useDeclineCategories();

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="page-container py-8 space-y-6">
      <PageHeader
        title="Categorías de candidatos"
        description="Catálogos por tenant para motivos de rechazo y declinación. Renombrar o desactivar no afecta el historial."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBlock
          title="Motivos de rechazo"
          kind="rejection"
          query={rejection}
          createFn={createRejectionCategory}
          updateFn={updateRejectionCategory}
        />
        <CategoryBlock
          title="Motivos de declinación"
          kind="decline"
          query={decline}
          createFn={createDeclineCategory}
          updateFn={updateDeclineCategory}
        />
      </div>
    </div>
  );
}
