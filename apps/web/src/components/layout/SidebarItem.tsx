import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { emit } from "@/lib/telemetry";
import type { NavItem } from "@/lib/nav-config";

interface SidebarItemProps {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  onNavigate?: () => void;
}

export function SidebarItem({
  item,
  collapsed,
  isActive,
  onNavigate,
}: SidebarItemProps) {
  const Icon = item.icon;

  const handleClick = () => {
    emit({
      name: "nav.click",
      payload: { itemId: item.id, path: item.path, source: "sidebar" },
    });
    onNavigate?.();
  };

  return (
    <NavLink
      to={item.path}
      data-active={isActive ? "true" : "false"}
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
      onClick={handleClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 ease-out",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[active=true]:bg-accent data-[active=true]:text-accent-foreground data-[active=true]:font-medium",
        // Active-indicator slide (T099): barra vertical primary en el borde izquierdo,
        // crece de 0 a 1.5rem cuando el item es activo (200ms ease-out).
        "before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-0.5 before:h-0 before:rounded-r-full before:bg-primary before:transition-[height] before:duration-200 before:ease-out",
        "data-[active=true]:before:h-6",
        "motion-reduce:before:transition-none motion-reduce:transition-none",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span
        data-slot="sidebar-item-label"
        className={cn(
          "truncate",
          collapsed && "sr-only",
        )}
      >
        {item.label}
      </span>
    </NavLink>
  );
}
