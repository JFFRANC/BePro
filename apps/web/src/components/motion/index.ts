// Motion library re-export — feature 009 follow-up.
// Se importa desde `motion/react` (no desde `motion` a secas) para
// habilitar tree-shaking por sub-path. Consumidores del repo deben
// importar SIEMPRE desde "@/components/motion" para tener un unico
// punto de entrada; facilita auditoria de bundle size y permite
// cambiar de biblioteca sin tocar call-sites.

export { motion, AnimatePresence, LayoutGroup } from "motion/react";
export type {
  MotionProps,
  Transition,
  Variants,
  Target,
} from "motion/react";

// Auto-animate — para mutaciones de listas (filter chips, multi-select).
export { useAutoAnimate } from "@formkit/auto-animate/react";
