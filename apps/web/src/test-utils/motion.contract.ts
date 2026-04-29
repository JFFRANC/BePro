// Motion contract: unica fuente de verdad para las duraciones y curvas de
// animacion definidas en specs/009-ui-visual-refresh/contracts/motion.md.
//
// Cualquier ajuste al presupuesto de motion debe actualizar este archivo;
// los tests validan classes duration-* contra este map.

export type SurfaceKey =
  | "button-hover"
  | "button-press"
  | "card-hover"
  | "list-row-hover"
  | "dialog-enter"
  | "dialog-exit"
  | "sheet-enter"
  | "sheet-exit"
  | "popover-enter"
  | "popover-exit"
  | "tooltip-enter"
  | "toast-enter"
  | "toast-exit"
  | "tabs-indicator"
  | "route-transition"
  | "skeleton-pulse"
  | "login-stagger-step"
  | "list-stagger-step"
  | "stat-count-up"
  | "sidebar-indicator"
  | "form-field-focus"
  | "form-error-reveal"
  | "card-lift";

export interface MotionSurface {
  durationMs: number;
  easing: "ease-out" | "ease-in" | "ease-in-out";
  reducedMotionStrategy: "opacity-only" | "instant" | "disable";
}

export const MOTION_CONTRACT: Record<SurfaceKey, MotionSurface> = {
  "button-hover": { durationMs: 120, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "button-press": { durationMs: 80, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "card-hover": { durationMs: 150, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "list-row-hover": { durationMs: 120, easing: "ease-out", reducedMotionStrategy: "instant" },
  "dialog-enter": { durationMs: 200, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "dialog-exit": { durationMs: 150, easing: "ease-in", reducedMotionStrategy: "opacity-only" },
  "sheet-enter": { durationMs: 250, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "sheet-exit": { durationMs: 200, easing: "ease-in", reducedMotionStrategy: "opacity-only" },
  "popover-enter": { durationMs: 120, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "popover-exit": { durationMs: 100, easing: "ease-in", reducedMotionStrategy: "opacity-only" },
  "tooltip-enter": { durationMs: 100, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "toast-enter": { durationMs: 250, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "toast-exit": { durationMs: 150, easing: "ease-in", reducedMotionStrategy: "opacity-only" },
  "tabs-indicator": { durationMs: 200, easing: "ease-out", reducedMotionStrategy: "instant" },
  "route-transition": { durationMs: 350, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "skeleton-pulse": { durationMs: 1500, easing: "ease-in-out", reducedMotionStrategy: "disable" },
  "login-stagger-step": { durationMs: 180, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "list-stagger-step": { durationMs: 180, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "stat-count-up": { durationMs: 600, easing: "ease-out", reducedMotionStrategy: "instant" },
  "sidebar-indicator": { durationMs: 200, easing: "ease-out", reducedMotionStrategy: "instant" },
  "form-field-focus": { durationMs: 120, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "form-error-reveal": { durationMs: 150, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
  "card-lift": { durationMs: 150, easing: "ease-out", reducedMotionStrategy: "opacity-only" },
};

// Delays para choreography stagger.
export const STAGGER_STEP_MS = {
  login: 80,
  list: 40,
  dashboard: 50,
} as const;

// Duracion Tailwind utility -> ms (para mapear durations a clases).
export const TAILWIND_DURATION_CLASS: Record<number, string> = {
  75: "duration-75",
  100: "duration-100",
  120: "duration-[120ms]",
  150: "duration-150",
  180: "duration-[180ms]",
  200: "duration-200",
  250: "duration-[250ms]",
  300: "duration-300",
  350: "duration-[350ms]",
  400: "duration-[400ms]",
  500: "duration-500",
  600: "duration-[600ms]",
};

export function durationClassFor(ms: number): string {
  return TAILWIND_DURATION_CLASS[ms] ?? `duration-[${ms}ms]`;
}
