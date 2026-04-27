import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon, MinusIcon } from "lucide-react"

// Checkbox modernizado (feature 009 follow-up).
// - Radius sube a 5px (alineado con el ritmo de 8-10px del resto).
// - Indicator anima scale + fade (150ms) al checkear; respeta reduced-motion.
// - Soporte visual para indeterminate via data-indeterminate.

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "group/checkbox peer relative flex size-4 shrink-0 items-center justify-center rounded-[5px] border border-input",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-out",
        "outline-none group-has-disabled/field:opacity-50",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "aria-invalid:aria-checked:border-primary",
        "dark:bg-input/30",
        "dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary",
        // Indeterminate: tambien usa primary fill.
        "data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        // Fill animation: zoom-in + fade-in, 150ms, motion-reduce counterpart.
        className={cn(
          "grid place-content-center text-current",
          "data-checked:animate-in data-checked:zoom-in-50 data-checked:fade-in-0 data-checked:duration-150",
          "data-indeterminate:animate-in data-indeterminate:zoom-in-50 data-indeterminate:fade-in-0 data-indeterminate:duration-150",
          "motion-reduce:animate-none motion-reduce:zoom-in-100 motion-reduce:fade-in-100",
          "[&>svg]:size-3.5",
        )}
      >
        {/*
          Base UI emite el mismo nodo para checked + indeterminate — el caller
          controla el estado. Mostramos Check por defecto y Minus cuando
          data-indeterminate esta presente en el root (selector CSS).
        */}
        <CheckIcon className="group-data-indeterminate/checkbox:hidden" />
        <MinusIcon className="hidden group-data-indeterminate/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
