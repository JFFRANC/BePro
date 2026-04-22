import { useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Monitor, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { emit } from "@/lib/telemetry";

type ThemeValue = "light" | "dark" | "system";

function pickIcon(theme: string | undefined, resolvedTheme: string | undefined) {
  if (theme === "system") return Monitor;
  if (resolvedTheme === "dark") return Moon;
  return Sun;
}

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const current = (theme ?? "system") as ThemeValue;
  const Icon = pickIcon(theme, resolvedTheme);

  const handleChange = (value: string) => {
    const next = value as ThemeValue;
    emit({ name: "theme.change", payload: { value: next } });
    setTheme(next);
    // Base-UI RadioItem doesn't close the menu by default (selection can
    // be changed without dismissing). Close explicitly after a user pick.
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            data-slot="theme-toggle-trigger"
            variant="ghost"
            size="icon-sm"
            aria-label="Cambiar tema"
          >
            <Icon aria-hidden="true" />
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={current} onValueChange={handleChange}>
          <DropdownMenuRadioItem value="light">
            <Sun aria-hidden="true" />
            Claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon aria-hidden="true" />
            Oscuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor aria-hidden="true" />
            Sistema
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
