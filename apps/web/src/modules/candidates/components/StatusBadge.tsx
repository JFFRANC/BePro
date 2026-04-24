// 007-candidates-module — badge de estado del candidato.
// Reusa los tokens dedicados del design system (003-design-system) — 14 variantes
// `status-*` ya existen en `apps/web/src/components/ui/badge.tsx`.
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { statusLabel, type CandidateStatus } from "@bepro/shared";
import { statusToBadgeVariant } from "@/lib/status-utils";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function StatusBadge({
  status,
  className,
}: {
  status: CandidateStatus;
  className?: string;
}) {
  const variant = statusToBadgeVariant(status) as BadgeVariant;
  return (
    <Badge
      variant={variant}
      className={cn(className)}
      aria-label={`Estado: ${statusLabel(status)}`}
    >
      {statusLabel(status)}
    </Badge>
  );
}
