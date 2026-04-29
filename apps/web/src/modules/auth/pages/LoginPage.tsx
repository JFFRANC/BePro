import { Navigate } from "react-router-dom";
import { motion, type Variants } from "motion/react";
import { LoginForm } from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";
import { AuroraBackground } from "@/components/motion/AuroraBackground";
import { useSpotlight } from "@/components/motion/useSpotlight";

// Choreography v2 con Framer Motion: orquestamos parent → children con
// staggerChildren + delayChildren en lugar de animation-delay manual. Esto
// permite springs reales (overshoot, bounce) y composicion entre estados.
//
// Reduced-motion: el global rule de index.css (animation-duration: 0.01ms)
// + Framer Motion's `useReducedMotion` (que respeta el media query) cancelan
// los movimientos. Con motion-safe en CSS y springs cortas, el contenido
// queda visible en frame 0.

const containerVariants: Variants = {
  hidden: { opacity: 1 }, // visible from start, just orchestrates children
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.1,
      staggerChildren: 0.0,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.93 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 105,
      damping: 16,
      mass: 0.85,
      // Cuando el card aparece, sus hijos comienzan a staggerse despues de
      // 0.45s — tiempo suficiente para que el spring del card "asiente".
      delayChildren: 0.45,
      staggerChildren: 0.09,
    },
  },
};

const titleContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0,
      staggerChildren: 0.055,
    },
  },
};

const charVariants: Variants = {
  hidden: { opacity: 0, y: 28, rotateX: -50 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { type: "spring", stiffness: 240, damping: 18, mass: 0.6 },
  },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

const TITLE_CHARS = "BePro".split("");

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const cardRef = useSpotlight<HTMLDivElement>();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div
      data-testid="login-page"
      className="relative flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div
        className="motion-safe:animate-[aurora-fade-in_1100ms_ease-out_forwards] motion-safe:opacity-0"
        style={{ animationFillMode: "forwards" }}
      >
        <AuroraBackground />
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="relative w-full max-w-md"
      >
        {/* Glow detrás de la card — entrada chained con pulse continuo */}
        <div
          aria-hidden="true"
          className="absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/40 via-primary/20 to-accent/30 blur-3xl motion-safe:opacity-0"
          style={{
            animation:
              "glow-enter 900ms cubic-bezier(0.16,1,0.3,1) 100ms forwards, aurora-pulse 6s ease-in-out 1s infinite",
          }}
        />

        {/* Glass card */}
        <motion.div
          ref={cardRef}
          data-testid="login-card"
          variants={cardVariants}
          className={[
            "group/card relative overflow-hidden rounded-3xl",
            "border border-white/30 dark:border-white/10",
            "bg-card/75 dark:bg-card/55",
            "backdrop-blur-2xl backdrop-saturate-150",
            "px-7 py-9 sm:px-10 sm:py-11",
            "shadow-[0_30px_70px_-30px_oklch(0.45_0.18_235_/_0.45),0_0_0_1px_oklch(1_0_0_/_0.10)_inset]",
          ].join(" ")}
          style={{ transformPerspective: 1200 }}
        >
          {/* Top sheen — línea de luz en el filo del cristal */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/30"
          />

          {/* Sheen sweep — flash diagonal al cargar (one-shot) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              className="absolute inset-y-0 -left-1/3 w-1/3 motion-safe:animate-[sheen-sweep_1400ms_cubic-bezier(0.16,1,0.3,1)_900ms_forwards] opacity-0"
              style={{
                background:
                  "linear-gradient(110deg, transparent 0%, oklch(1 0 0 / 0.18) 50%, transparent 100%)",
                mixBlendMode: "overlay",
              }}
            />
          </div>

          {/* Spotlight follow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 motion-reduce:hidden"
            style={{
              background:
                "radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), oklch(0.65 0.18 235 / 0.14), transparent 60%)",
            }}
          />

          <header className="relative mb-7 text-center">
            {/* Title — character-split con spring + 3D rotateX */}
            <motion.h1
              variants={titleContainerVariants}
              data-testid="brand-title"
              aria-label="BePro"
              className="text-5xl font-bold tracking-tight inline-block"
              style={{
                fontFamily:
                  "'Geist Variable', 'Plus Jakarta Sans', system-ui, sans-serif",
                background:
                  "linear-gradient(120deg, oklch(0.48 0.18 235) 0%, oklch(0.62 0.17 250) 50%, oklch(0.48 0.18 235) 100%)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                animation: "brand-gradient-shift 8s ease-in-out 1.4s infinite",
                perspective: "800px",
              }}
            >
              {TITLE_CHARS.map((char, i) => (
                <motion.span
                  key={i}
                  variants={charVariants}
                  aria-hidden="true"
                  className="inline-block"
                  style={{ transformOrigin: "50% 100%" }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.h1>

            <motion.p
              variants={fadeUpVariants}
              className="mt-2 text-sm text-muted-foreground"
            >
              Reclutamiento sin fricciones.
            </motion.p>
          </header>

          {/* LoginForm: receives "visible" via variant propagation through
              the React tree. Each field and the submit button render motion
              children that participate in the parent's stagger. */}
          <LoginForm />

          <motion.footer
            variants={fadeUpVariants}
            className="mt-6 text-center text-xs text-muted-foreground/80"
          >
            Sistema de Reclutamiento y Selección
          </motion.footer>
        </motion.div>
      </motion.div>
    </div>
  );
}
