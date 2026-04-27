// 008-ux-roles-refinements / US3 — Per-row inline status transition dropdown.
// FR-ST-001..006: reads FSM valid transitions via transitionOptionsFor(),
// groups by category (Avanzar / Rechazar / Declinar / Reactivar), opens a
// category picker when the target requires one, commits optimistically, and
// rolls back on server error.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  transitionOptionsFor,
  type CandidateStatus,
  type TransitionActorRole,
  type TransitionCategory,
  type TransitionOption,
} from "@bepro/shared";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTransitionCandidate } from "../hooks/useCandidates";
import { CategoryPicker } from "./RejectionCategoryPicker";
import { ChevronDown } from "lucide-react";

interface InlineStatusMenuProps {
  candidateId: string;
  currentStatus: CandidateStatus;
  disabled?: boolean;
}

const CATEGORY_HEADERS: Record<TransitionCategory, string> = {
  advance: "Avanzar",
  reject: "Rechazar",
  decline: "Declinar",
  reactivate: "Reactivar",
};

const CATEGORY_ORDER: TransitionCategory[] = [
  "advance",
  "reject",
  "decline",
  "reactivate",
];

export function InlineStatusMenu({
  candidateId,
  currentStatus,
  disabled = false,
}: InlineStatusMenuProps) {
  const { user } = useAuth();
  const role = user?.role as TransitionActorRole | undefined;
  // 008 US3 — recruiters (FR-032) can't transition: empty options → disabled trigger.
  const options = useMemo(
    () => transitionOptionsFor(currentStatus, role),
    [currentStatus, role],
  );
  const transition = useTransitionCandidate(candidateId);
  const [pending, setPending] = useState<TransitionOption | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const hasOptions = options.length > 0;

  function commit(
    option: TransitionOption,
    extra?: { rejection_category_id?: string; decline_category_id?: string },
  ) {
    transition.mutate(
      {
        from_status: currentStatus,
        to_status: option.nextStatus,
        ...extra,
      },
      {
        onSuccess: () => {
          toast.success(`Estado cambiado a ${option.labelEs}`);
        },
        onError: (err: unknown) => {
          const message = extractStaleMessage(err);
          toast.error(
            message ??
              "No se pudo cambiar el estado. Intenta de nuevo.",
          );
        },
        onSettled: () => {
          setPending(null);
          setCategoryId(null);
        },
      },
    );
  }

  function handleSelect(option: TransitionOption) {
    if (option.requiresCategory) {
      setPending(option);
      return;
    }
    commit(option);
  }

  function handleConfirmCategory() {
    if (!pending || !categoryId) return;
    const extra =
      pending.category === "reject"
        ? { rejection_category_id: categoryId }
        : { decline_category_id: categoryId };
    commit(pending, extra);
  }

  const grouped = useMemo(() => {
    const byCat = new Map<TransitionCategory, TransitionOption[]>();
    for (const o of options) {
      const bucket = byCat.get(o.category) ?? [];
      bucket.push(o);
      byCat.set(o.category, bucket);
    }
    return CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => ({
      category: c,
      items: byCat.get(c)!,
    }));
  }, [options]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(triggerProps) => (
            <Button
              {...triggerProps}
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              disabled={disabled || !hasOptions || transition.isPending}
              aria-label={
                hasOptions
                  ? "Cambiar estado"
                  : "Sin transiciones disponibles"
              }
              data-slot="inline-status-menu-trigger"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              Cambiar estado
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}
        />
        <DropdownMenuContent align="end" sideOffset={4} className="min-w-48">
          {!hasOptions ? (
            <DropdownMenuItem disabled aria-disabled="true">
              Sin transiciones disponibles
            </DropdownMenuItem>
          ) : (
            grouped.map((group, idx) => (
              <div key={group.category}>
                {idx > 0 && <DropdownMenuSeparator />}
                <div className="px-2 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_HEADERS[group.category]}
                </div>
                {group.items.map((opt) => (
                  <DropdownMenuItem
                    key={opt.nextStatus}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(opt);
                    }}
                  >
                    {opt.labelEs}
                  </DropdownMenuItem>
                ))}
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
            setCategoryId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending ? `Cambiar a ${pending.labelEs}` : ""}
            </DialogTitle>
            <DialogDescription>
              Selecciona una categoría para registrar el cambio de estado.
            </DialogDescription>
          </DialogHeader>
          {pending && (
            <CategoryPicker
              kind={pending.category === "reject" ? "rejection" : "decline"}
              value={categoryId}
              onChange={setCategoryId}
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPending(null);
                setCategoryId(null);
              }}
              disabled={transition.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCategory}
              disabled={!categoryId || transition.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function extractStaleMessage(err: unknown): string | undefined {
  if (typeof err !== "object" || !err) return undefined;
  const maybe = err as {
    response?: { status?: number; data?: { code?: string; message?: string } };
  };
  const code = maybe.response?.data?.code;
  if (
    maybe.response?.status === 409 ||
    code === "invalid_transition" ||
    code === "stale_status"
  ) {
    return "El estado cambió en otro lugar, intenta de nuevo.";
  }
  return maybe.response?.data?.message;
}
