import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Feature 009: chips con profundidad. shadow-sm + ring-inset dan sensacion
  // de relieve sutil; transicion-all para hover suave; h-5.5 para un chip
  // un pelo mas prominente pero aun compacto.
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 transition-[transform,box-shadow,background-color] duration-150 ease-out hover:-translate-y-px hover:shadow-md motion-reduce:transform-none motion-reduce:hover:transform-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3! [&>svg]:stroke-[2]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",

        // Candidate FSM — Progress group
        "status-registered":
          "border-transparent bg-badge-registered text-badge-registered-fg",
        "status-interview-scheduled":
          "border-transparent bg-badge-interview-scheduled text-badge-interview-scheduled-fg",
        "status-attended":
          "border-transparent bg-badge-attended text-badge-attended-fg",
        "status-pending":
          "border-transparent bg-badge-pending text-badge-pending-fg",

        // Candidate FSM — Success group
        "status-approved":
          "border-transparent bg-badge-approved text-badge-approved-fg",
        "status-hired":
          "border-transparent bg-badge-hired text-badge-hired-fg",
        "status-in-guarantee":
          "border-transparent bg-badge-in-guarantee text-badge-in-guarantee-fg",
        "status-guarantee-met":
          "border-transparent bg-badge-guarantee-met text-badge-guarantee-met-fg",

        // Candidate FSM — Negative group
        "status-rejected":
          "border-transparent bg-badge-rejected text-badge-rejected-fg",
        "status-declined":
          "border-transparent bg-badge-declined text-badge-declined-fg",
        "status-no-show":
          "border-transparent bg-badge-no-show text-badge-no-show-fg",
        "status-termination":
          "border-transparent bg-badge-termination text-badge-termination-fg",

        // Candidate FSM — Neutral-terminal group
        "status-discarded":
          "border-transparent bg-badge-discarded text-badge-discarded-fg",
        "status-replacement":
          "border-transparent bg-badge-replacement text-badge-replacement-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
