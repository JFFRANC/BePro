import { cn } from "@/lib/utils"

// Feature 009: skeleton con shimmer (barrido de luz) en lugar de pulso.
// bg-muted base + gradiente diagonal animado via skeleton-shimmer keyframe
// (definido en apps/web/src/index.css). En reduced-motion queda estatico
// con bg-muted y opacity 0.7 para no causar mareo.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "bg-[linear-gradient(90deg,transparent_0%,var(--color-foreground)_50%,transparent_100%)]",
        "bg-[length:200%_100%] bg-no-repeat",
        "[animation:skeleton-shimmer_1.8s_ease-in-out_infinite]",
        "opacity-60",
        "motion-reduce:[animation:none] motion-reduce:bg-muted motion-reduce:bg-none motion-reduce:opacity-70",
        className
      )}
      style={{
        // Aplica el gradiente encima del bg-muted para que el shimmer sea
        // un "haz de luz" sutil (~6% opacity) sobre el color base.
        backgroundBlendMode: "overlay",
      }}
      {...props}
    />
  )
}

export { Skeleton }
