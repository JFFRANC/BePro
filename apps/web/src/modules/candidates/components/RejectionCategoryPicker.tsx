// 007-candidates-module — selector reusable de categoría (US3 / US5).
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useRejectionCategories,
  useDeclineCategories,
} from "../hooks/useCandidates";

interface CategoryPickerProps {
  kind: "rejection" | "decline";
  value: string | null;
  onChange: (id: string | null) => void;
}

export function CategoryPicker({ kind, value, onChange }: CategoryPickerProps) {
  const rejection = useRejectionCategories();
  const decline = useDeclineCategories();
  const items = kind === "rejection" ? rejection.data : decline.data;
  const loading = kind === "rejection" ? rejection.isLoading : decline.isLoading;

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onChange(v ?? null)}
      disabled={loading}
    >
      <SelectTrigger>
        <SelectValue
          placeholder={
            loading
              ? "Cargando…"
              : kind === "rejection"
                ? "Selecciona motivo de rechazo"
                : "Selecciona motivo de declinación"
          }
        />
      </SelectTrigger>
      <SelectContent>
        {(items ?? [])
          .filter((c) => c.is_active)
          .map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
