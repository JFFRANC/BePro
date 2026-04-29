import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// SearchInput modernizado (feature 009 follow-up).
// - Delega al compound slot pattern de Input (startIcon/endIcon) en lugar de
//   re-implementar absolute positioning. El boton de clear es el endIcon
//   cuando hay texto; cuando no, el slot queda vacio.

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
}: SearchInputProps) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      wrapperClassName={className}
      startIcon={<Search aria-hidden="true" />}
      endIcon={
        value ? (
          <button
            type="button"
            aria-label="Limpiar busqueda"
            onClick={() => onChange("")}
            className={cn(
              "pointer-events-auto flex size-5 items-center justify-center rounded-md",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors duration-150 ease-out",
              "animate-in fade-in-0 zoom-in-90 duration-150",
              "motion-reduce:zoom-in-100",
            )}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : undefined
      }
    />
  );
}
