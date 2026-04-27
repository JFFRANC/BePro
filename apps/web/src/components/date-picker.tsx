import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { triggerBaseClasses } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// DatePicker modernizado (feature 009 follow-up).
// - Usa triggerBaseClasses para alinear visualmente con Select + Combobox.

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  disabled,
  className,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          triggerBaseClasses,
          "justify-start font-normal",
          !value && "text-muted-foreground",
          className,
        )}
      >
        <CalendarIcon className="mr-1 size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-left truncate">
          {value ? format(value, "PPP", { locale: es }) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
        />
      </PopoverContent>
    </Popover>
  );
}
