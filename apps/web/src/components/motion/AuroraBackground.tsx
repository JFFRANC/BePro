import { cn } from "@/lib/utils";

interface AuroraBackgroundProps {
  className?: string;
}

// Capa de fondo decorativa para pantallas tipo "front door" (login, errores
// críticos). Cuatro blobs OKLch derivados de la paleta primary/accent que
// derivan suavemente, un grid de puntos sutil enmascarado al centro, y una
// viñeta exterior. La capa entera es aria-hidden y pointer-events-none.
//
// Reduced-motion: los blobs usan motion-safe:animate-* y el global
// `prefers-reduced-motion` rule en index.css fuerza la duración a 0.01ms,
// dejando el contenido visible y estático.
export function AuroraBackground({ className }: AuroraBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="aurora-background"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background",
        className,
      )}
    >
      {/* Blob 1 — primary, top-left, the largest */}
      <div
        data-aurora-blob="1"
        className="absolute -left-[20vw] -top-[20vh] h-[70vh] w-[70vh] rounded-full opacity-80 blur-[110px] mix-blend-screen motion-safe:animate-[aurora-drift-1_22s_ease-in-out_infinite] dark:mix-blend-plus-lighter"
        style={{
          background:
            "radial-gradient(circle at center, oklch(0.62 0.21 235 / 0.62), transparent 70%)",
          willChange: "transform",
        }}
      />

      {/* Blob 2 — cooler blue, top-right */}
      <div
        data-aurora-blob="2"
        className="absolute -right-[12vw] top-[5vh] h-[60vh] w-[60vh] rounded-full opacity-70 blur-[120px] mix-blend-screen motion-safe:animate-[aurora-drift-2_28s_ease-in-out_infinite] dark:mix-blend-plus-lighter"
        style={{
          background:
            "radial-gradient(circle at center, oklch(0.70 0.17 220 / 0.55), transparent 70%)",
          willChange: "transform",
        }}
      />

      {/* Blob 3 — violet hint, bottom-center */}
      <div
        data-aurora-blob="3"
        className="absolute bottom-[-10vh] left-[20vw] h-[55vh] w-[55vh] rounded-full opacity-60 blur-[130px] mix-blend-screen motion-safe:animate-[aurora-drift-3_34s_ease-in-out_infinite] dark:mix-blend-plus-lighter"
        style={{
          background:
            "radial-gradient(circle at center, oklch(0.78 0.13 260 / 0.50), transparent 70%)",
          willChange: "transform",
        }}
      />

      {/* Blob 4 — teal accent, bottom-right */}
      <div
        data-aurora-blob="4"
        className="absolute -bottom-[15vh] -right-[10vw] h-[50vh] w-[50vh] rounded-full opacity-60 blur-[100px] mix-blend-screen motion-safe:animate-[aurora-drift-4_40s_ease-in-out_infinite] dark:mix-blend-plus-lighter"
        style={{
          background:
            "radial-gradient(circle at center, oklch(0.65 0.14 200 / 0.50), transparent 70%)",
          willChange: "transform",
        }}
      />

      {/* Dotted grid — currentColor inherits from foreground; mask fades to edges */}
      <div
        data-aurora-grid
        className="absolute inset-0 text-foreground opacity-[0.06] dark:opacity-[0.10]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1.5px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at 50% 50%, black 25%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 50%, black 25%, transparent 80%)",
        }}
      />

      {/* Outer vignette — keeps focus on center */}
      <div
        data-aurora-vignette
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 55%, oklch(0 0 0 / 0.18) 100%)",
        }}
      />
    </div>
  );
}
