import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    <div className={cn("relative", className)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none transition-colors duration-150"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          aria-label="Limpiar busqueda"
          onClick={() => onChange("")}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2",
            "flex size-6 items-center justify-center rounded-md",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors duration-150 ease-out",
            "animate-in fade-in-0 zoom-in-90 duration-150",
            "motion-reduce:zoom-in-100",
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
