export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  account_executive: "Ejecutivo de cuenta",
  recruiter: "Reclutador",
};

export const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  manager: "outline",
  account_executive: "outline",
  recruiter: "secondary",
};

export const PASSWORD_HINT = "Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número";
