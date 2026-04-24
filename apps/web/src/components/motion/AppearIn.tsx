import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";

// Primitiva de motion: envuelve un elemento para que aparezca con fade + slide-in.
// Opcionalmente acepta un `delayMs` para que consumidores armen staggers manuales.
// Respeta prefers-reduced-motion (slide colapsa, fade se mantiene corto).

interface AppearInProps {
  children: ReactNode;
  delayMs?: number;
  durationMs?: number;
  as?: ElementType;
  className?: string;
}

export function AppearIn({
  children,
  delayMs = 0,
  durationMs = 180,
  as: Tag = "div",
  className,
}: AppearInProps) {
  return (
    <Tag
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-1 ease-out",
        "motion-reduce:slide-in-from-bottom-0",
        className,
      )}
      style={{
        animationDelay: `${delayMs}ms`,
        animationDuration: `${durationMs}ms`,
        animationFillMode: "both",
      }}
    >
      {children}
    </Tag>
  );
}

// StaggerGroup: renderiza children aplicando animationDelay incremental al
// primer nivel. Limita a 10 children para evitar staggers interminables
// (beyond index 9 -> no delay, aparece simultaneamente con el ultimo staggered).
interface StaggerGroupProps {
  children: ReactNode[];
  stepMs?: number;
  durationMs?: number;
  maxStagger?: number;
  className?: string;
  itemClassName?: string;
  as?: ElementType;
}

export function StaggerGroup({
  children,
  stepMs = 40,
  durationMs = 180,
  maxStagger = 10,
  className,
  itemClassName,
  as: Tag = "div",
}: StaggerGroupProps) {
  return (
    <Tag className={className}>
      {children.map((child, index) => {
        const delay = index < maxStagger ? index * stepMs : maxStagger * stepMs;
        return (
          <AppearIn
            key={index}
            delayMs={delay}
            durationMs={durationMs}
            className={itemClassName}
          >
            {child}
          </AppearIn>
        );
      })}
    </Tag>
  );
}
