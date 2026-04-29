import { useCallback, useEffect, useRef } from "react";

// Hook para el efecto spotlight (feature card variant): actualiza las CSS
// variables --mx / --my con la posicion del cursor dentro del elemento. El
// radial-gradient en el ::before del card sigue al mouse, creando el "haz
// de luz" tipico de UIs modernas.
//
// Respeta prefers-reduced-motion: si el usuario lo tiene activado, no se
// suscribe al evento mousemove (evita trabajo innecesario y mantiene el
// card estatico).

export function useSpotlight<T extends HTMLElement>(): React.RefCallback<T> {
  const elRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);

  const handleMove = useCallback((event: MouseEvent) => {
    const el = elRef.current;
    if (!el) return;
    // rAF para no pisar el frame si el mouse se mueve muy rapido.
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Callback ref: cuando el nodo se monta, nos subscribimos a mousemove.
  // Cuando se desmonta (o cambia la pref de motion), limpiamos.
  const setRef = useCallback(
    (node: T | null) => {
      // Limpieza previa
      if (elRef.current) {
        elRef.current.removeEventListener("mousemove", handleMove);
      }
      elRef.current = node;
      if (!node) return;

      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        // En reduced-motion no adjuntamos el listener: el radial queda
        // centrado (50%/50%) gracias al fallback CSS.
        return;
      }
      node.addEventListener("mousemove", handleMove);
    },
    [handleMove],
  );

  return setRef;
}
