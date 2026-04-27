import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

// Input modernizado (feature 009 follow-up).
// - Compound slot pattern: `startIcon` / `endIcon` renderizan icon en 16px
//   posicionado absolutamente dentro del wrapper, y el input aplica pl-9 / pr-9
//   cuando los slots estan presentes. Reemplaza el pattern manual
//   (absolute-positioned icon + pl-9) que cada caller duplicaba.

interface InputProps extends React.ComponentProps<"input"> {
  error?: boolean
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
  /** className extra para el wrapper (cuando hay icons). */
  wrapperClassName?: string
}

function Input({
  className,
  type,
  error,
  startIcon,
  endIcon,
  wrapperClassName,
  ...props
}: InputProps) {
  const inputElement = (
    <InputPrimitive
      type={type}
      data-slot="input"
      aria-invalid={error || undefined}
      className={cn(
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
        // Slot padding: agregamos espacio solo si el slot existe.
        startIcon && "pl-9",
        endIcon && "pr-9",
        className
      )}
      {...props}
    />
  )

  // Sin icons: rendering directo del input (backwards compatible).
  if (!startIcon && !endIcon) {
    return inputElement
  }

  return (
    <div
      data-slot="input-wrapper"
      className={cn("relative inline-flex w-full items-center", wrapperClassName)}
    >
      {startIcon && (
        <span
          data-slot="input-start-icon"
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:size-4"
        >
          {startIcon}
        </span>
      )}
      {inputElement}
      {endIcon && (
        <span
          data-slot="input-end-icon"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:size-4"
        >
          {endIcon}
        </span>
      )}
    </div>
  )
}

export { Input }
