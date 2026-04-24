import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({
  className,
  type,
  error,
  ...props
}: React.ComponentProps<"input"> & { error?: boolean }) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      aria-invalid={error || undefined}
      className={cn(
        // Feature 009: input con presencia.
        //  - h-9 (36px) mas comodo para touch que h-8
        //  - shadow-xs da profundidad sin competir
        //  - bg-card (blanco real) en vez de transparent para destacar del fondo
        //  - hover fortalece el borde para invitar interaccion
        //  - focus crece la sombra y ring de forma suave (transition 150ms)
        "h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-base shadow-xs",
        "transition-[box-shadow,border-color,background-color] duration-150 ease-out",
        "outline-none placeholder:text-muted-foreground",
        "hover:border-input/80 hover:shadow-sm",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:shadow-sm",
        "file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 disabled:shadow-none",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        "md:text-sm",
        "dark:bg-input/40 dark:hover:bg-input/60 dark:disabled:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
