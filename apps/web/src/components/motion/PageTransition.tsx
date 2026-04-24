import { useLocation } from "react-router-dom";
import type { PropsWithChildren } from "react";

// Fade + slight slide-up al cambiar de ruta.
// Se apoya en `key={pathname}` para remontar el contenedor en cada navegacion
// -> dispara la animacion animate-in. Interrupt-safe: si la ruta cambia mientras
// la animacion esta en curso, React desmonta el arbol anterior y monta el nuevo,
// cancelando la animacion antigua automaticamente (sin layering).
export function PageTransition({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  return (
    <div
      key={pathname}
      data-slot="page-transition"
      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-[350ms] ease-out motion-reduce:animate-in motion-reduce:fade-in-0 motion-reduce:slide-in-from-bottom-0 motion-reduce:duration-150"
    >
      {children}
    </div>
  );
}
