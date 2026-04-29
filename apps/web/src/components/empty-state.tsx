import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

// Feature 009: empty-state con presencia. Icono con anillo + halo sutil,
// animacion de entrada (fade + scale suave), tipografia clara y CTA destacada.
// La animacion respeta prefers-reduced-motion.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        "animate-in fade-in-0 zoom-in-95 duration-300 ease-out",
        "motion-reduce:zoom-in-100 motion-reduce:duration-150",
        className,
      )}
    >
      {/* Icon container con halo radial para dar profundidad */}
      <div
        className={cn(
          "relative flex size-16 items-center justify-center rounded-2xl",
          "bg-gradient-to-b from-muted to-muted/50 ring-1 ring-inset ring-border",
          "shadow-sm",
          // Halo primary detras
          "before:absolute before:inset-0 before:-z-10 before:rounded-2xl before:bg-primary/10 before:blur-xl before:opacity-60",
        )}
      >
        <Icon className="size-7 text-muted-foreground" />
      </div>

      <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
