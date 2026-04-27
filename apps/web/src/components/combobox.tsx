import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { triggerBaseClasses } from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Combobox modernizado (feature 009 follow-up).
// - Usa triggerBaseClasses para alinear visualmente con SelectTrigger + DatePicker.
// - CommandItem seleccionado muestra Check icon (antes era invisible cual opcion estaba activa).

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados.",
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        className={cn(triggerBaseClasses, "font-normal", className)}
      >
        <span
          className={cn(
            "flex-1 text-left truncate",
            !selectedLabel && "text-muted-foreground",
          )}
        >
          {selectedLabel ?? placeholder}
        </span>
        <ChevronsUpDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out data-[state=open]:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange?.(isSelected ? "" : option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4 transition-opacity duration-150",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
