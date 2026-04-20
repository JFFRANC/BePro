import { Building2 } from "lucide-react";
import { useAuth } from "@/modules/auth/hooks/useAuth";

export function TenantBadge() {
  const { user } = useAuth();
  const tenantLabel = user?.tenantId ?? "";

  return (
    <div
      data-slot="tenant-badge"
      className="flex items-center gap-2 min-w-0"
    >
      <Building2
        aria-hidden="true"
        className="size-5 shrink-0 text-primary"
      />
      <span className="text-sm font-semibold text-foreground tracking-tight">
        BePro
      </span>
      {tenantLabel ? (
        <span
          data-slot="tenant-badge-label"
          title={tenantLabel}
          className="hidden md:inline-block max-w-[14rem] truncate text-xs text-muted-foreground"
        >
          {tenantLabel}
        </span>
      ) : null}
    </div>
  );
}
