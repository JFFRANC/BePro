import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Feature 009: alineado con Input — superficie card + shadow + hover/focus
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-base shadow-xs",
        "transition-[box-shadow,border-color,background-color] duration-150 ease-out",
        "outline-none placeholder:text-muted-foreground",
        "hover:border-input/80 hover:shadow-sm",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:shadow-sm",
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

export { Textarea }
