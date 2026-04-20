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
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[active=true]:bg-muted data-[active=true]:text-foreground data-[active=true]:font-medium",
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
