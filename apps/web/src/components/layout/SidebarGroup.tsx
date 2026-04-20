import { cn } from "@/lib/utils";
import type { NavGroup, NavItem } from "@/lib/nav-config";
import { SidebarItem } from "./SidebarItem";

interface SidebarGroupProps {
  group: NavGroup;
  visibleItems: NavItem[];
  activeItemId: string | null;
  collapsed: boolean;
}

export function SidebarGroup({
  group,
  visibleItems,
  activeItemId,
  collapsed,
}: SidebarGroupProps) {
  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {group.label ? (
        <p
          className={cn(
            "px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground",
            collapsed && "sr-only",
          )}
        >
          {group.label}
        </p>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <SidebarItem
              item={item}
              collapsed={collapsed}
              isActive={activeItemId === item.id}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
