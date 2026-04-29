import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useSpotlight } from "@/components/motion/useSpotlight"

// Card primitive modernizado (feature 009 follow-up).
// - Variants via CVA: default / outline / ghost / feature / accent
// - interactive prop: activa hover-lift + cursor-pointer + tabIndex + focus ring
// - spotlight automatico en variant=feature (radial gradient que sigue el mouse)
// - Spring easing (OutExpo-ish) para todas las transiciones
// - motion-reduce: counterparts en cada transformacion

const cardVariants = cva(
  [
    // Base — layout y tipografia + motion shared por todas las variantes
    "group/card relative flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground",
    "transition-[transform,box-shadow,border-color] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
    "motion-reduce:transform-none motion-reduce:transition-[box-shadow,border-color]",
    "has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0",
    "*:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border border-border shadow-sm",
        outline: "border-2 border-border shadow-none",
        ghost: "border border-transparent bg-muted/40 shadow-none",
        // Feature — hero card. Gradient border + layered shadow + spotlight
        // via pseudo-element (--mx/--my actualizadas por useSpotlight).
        feature: [
          "group/card-feature",
          "border border-border/60 shadow-lg shadow-primary/5",
          // Gradient border top edge para emfasis sutil
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-xl",
          "before:bg-[radial-gradient(400px_circle_at_var(--mx,50%)_var(--my,50%),hsl(var(--primary)/0.12),transparent_40%)]",
          "before:opacity-0 before:transition-opacity before:duration-[250ms]",
          "hover:before:opacity-100",
          "motion-reduce:before:hidden",
          // Subtle gradient background accent
          "bg-gradient-to-br from-card via-card to-primary/[0.02]",
        ].join(" "),
        accent: "border border-border shadow-sm border-t-[3px]",
      },
      size: {
        default: "gap-4 py-4 has-data-[slot=card-footer]:pb-0",
        sm: "gap-3 py-3 has-data-[slot=card-footer]:pb-0",
      },
      interactive: {
        true: [
          "cursor-pointer",
          "data-[interactive=true]:hover:-translate-y-0.5 data-[interactive=true]:hover:shadow-lg",
          "data-[interactive=true]:active:translate-y-0 data-[interactive=true]:active:scale-[0.99] data-[interactive=true]:active:duration-75",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "motion-reduce:hover:transform-none motion-reduce:active:transform-none",
        ].join(" "),
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      interactive: false,
    },
  },
)

export interface CardProps
  extends React.ComponentProps<"div">,
    Omit<VariantProps<typeof cardVariants>, "interactive"> {
  interactive?: boolean
  /** Tailwind class para el stripe cuando variant="accent" (ej "border-t-success"). */
  accentColor?: string
}

function Card({
  className,
  variant = "default",
  size = "default",
  interactive = false,
  accentColor,
  ...props
}: CardProps) {
  const spotlightRef = useSpotlight<HTMLDivElement>()

  // Para variant=accent, agregamos el color del stripe. Default a primary.
  const accentStripe =
    variant === "accent" ? accentColor ?? "border-t-primary" : undefined

  // Para interactive, setear data-interactive=true y tabIndex=0 si el consumidor no lo override.
  const interactiveProps = interactive
    ? {
        "data-interactive": "true" as const,
        tabIndex: props.tabIndex ?? 0,
      }
    : {}

  const commonProps = {
    "data-slot": "card",
    "data-size": size,
    "data-variant": variant,
    className: cn(
      cardVariants({ variant, size, interactive }),
      accentStripe,
      className,
    ),
    ...interactiveProps,
    ...props,
  }

  // variant=feature necesita el ref del spotlight; el resto no usa ref.
  if (variant === "feature") {
    return <div ref={spotlightRef} {...commonProps} />
  }
  return <div {...commonProps} />
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header relative z-[1] grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("relative z-[1] px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "relative z-[1] flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
}
