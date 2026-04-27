import { Children, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// CardGrid — wrapper ligero que aplica stagger de entrada (40ms por item)
// a los primeros 10 hijos. Items 11+ reciben un delay constante de 400ms
// para evitar que el usuario espere secuencias largas. Respeta
// prefers-reduced-motion via la utility motion-reduce:animate-none.
//
// Uso:
//   <CardGrid className="grid grid-cols-4 gap-4">
//     <Card>...</Card>
//     <Card>...</Card>
//   </CardGrid>

interface CardGridProps {
  children: ReactNode;
  className?: string;
  /** Multiplicador de delay entre items (default 40ms). */
  staggerMs?: number;
  /** Indice a partir del cual el delay deja de escalar (default 10). */
  cap?: number;
}

export function CardGrid({
  children,
  className,
  staggerMs = 40,
  cap = 10,
}: CardGridProps) {
  const array = Children.toArray(children).filter(isValidElement);

  return (
    <div data-slot="card-grid" className={cn(className)}>
      {array.map((child, index) => {
        const delayMs = index < cap ? index * staggerMs : cap * staggerMs;
        return (
          <div
            key={(child as { key?: string }).key ?? index}
            data-slot="card-grid-item"
            className="animate-in fade-in-0 slide-in-from-top-2 duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none motion-reduce:slide-in-from-top-0"
            style={{
              animationDelay: `${delayMs}ms`,
              animationFillMode: "both",
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
