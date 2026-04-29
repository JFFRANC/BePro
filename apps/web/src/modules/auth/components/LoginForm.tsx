import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@bepro/shared";
import { useAuth } from "../hooks/useAuth";
import { useRef, useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { motion, type Variants } from "motion/react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 008-ux-roles-refinements / US8 — single-tenant deploys ocultan el campo
// "Organización" y envían el slug fijo. Se evalúa al cargar el módulo para
// que `vi.stubEnv` + `vi.resetModules` puedan controlarlo en pruebas.
const FIXED_TENANT_SLUG = (
  import.meta.env.VITE_LOGIN_TENANT_FIXED ?? ""
).trim();

// Variants — los hereda el motion ancestor de LoginPage (la card) que tiene
// staggerChildren. Cada motion.div con `variants` participa del stagger pool
// independientemente de la profundidad en el arbol React (Framer Motion
// camina hasta el motion ancestor mas cercano con `animate`).

const fieldVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 240, damping: 22 },
  },
};

// Submit button: overshoot pop — escala desde 0.85 sobrepasa 1.06 y vuelve
// a 1. La curva backOut da el "thunk" satisfactorio del CTA aterrizando.
const submitVariants: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: [0.85, 1.06, 1],
    transition: {
      duration: 0.55,
      times: [0, 0.65, 1],
      ease: ["easeOut", "easeOut"],
    },
  },
};

export function LoginForm() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      tenantSlug: FIXED_TENANT_SLUG,
    },
  });

  // Shake horizontal imperativo — usamos clase CSS + force reflow para
  // re-disparar la animacion en errores consecutivos. Decoupleado de
  // Framer Motion para no romper la propagacion de variants.
  const triggerShake = () => {
    const el = formRef.current;
    if (!el) return;
    el.classList.remove("login-shake");
    void el.offsetHeight; // force reflow
    el.classList.add("login-shake");
  };

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    try {
      const tenantSlug = FIXED_TENANT_SLUG || data.tenantSlug;
      await login(data.email, data.password, tenantSlug);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(
        axiosError.response?.data?.error ?? "Error al iniciar sesión",
      );
      triggerShake();
    }
  };

  const onInvalid = () => triggerShake();

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="space-y-4"
      noValidate
    >
      {!FIXED_TENANT_SLUG && (
        <motion.div variants={fieldVariants}>
          <FormField
            id="tenantSlug"
            label="Organización"
            error={errors.tenantSlug?.message}
          >
            <Input
              id="tenantSlug"
              type="text"
              placeholder="mi-empresa"
              autoComplete="organization"
              startIcon={<Building2 aria-hidden="true" />}
              error={!!errors.tenantSlug}
              {...register("tenantSlug")}
            />
          </FormField>
        </motion.div>
      )}

      <motion.div variants={fieldVariants}>
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            placeholder="correo@ejemplo.com"
            autoComplete="email"
            startIcon={<Mail aria-hidden="true" />}
            error={!!errors.email}
            {...register("email")}
          />
        </FormField>
      </motion.div>

      <motion.div variants={fieldVariants}>
        <FormField
          id="password"
          label="Contraseña"
          error={errors.password?.message}
        >
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            startIcon={<Lock aria-hidden="true" />}
            endIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                title={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                className={cn(
                  "pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md",
                  "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "transition-[color,background-color,transform] duration-150",
                  showPassword && "text-foreground",
                )}
              >
                {/* sr-only label evita colisionar con getByLabelText
                    (/contraseña/i) del input principal mientras conserva
                    el nombre accesible. */}
                <span className="sr-only">
                  {showPassword ? "Ocultar valor" : "Mostrar valor"}
                </span>
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            }
            error={!!errors.password}
            {...register("password")}
          />
        </FormField>
      </motion.div>

      {error && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </motion.div>
      )}

      <motion.div variants={submitVariants} className="pt-1">
        <Button
          type="submit"
          size="lg"
          className="group/login w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              <span>Iniciando sesión…</span>
            </>
          ) : (
            <>
              <span>Iniciar sesión</span>
              <ArrowRight
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-150 ease-out group-hover/login:translate-x-0.5"
              />
            </>
          )}
        </Button>
      </motion.div>
    </form>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

function FormField({ id, label, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-foreground/90">
        {label}
      </Label>
      {children}
      {error && (
        <p
          role="alert"
          className="text-xs text-destructive motion-safe:animate-[fade-up_180ms_ease-out] motion-safe:animate-fill-both"
        >
          {error}
        </p>
      )}
    </div>
  );
}
