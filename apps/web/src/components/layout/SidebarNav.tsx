import { useLocation } from "react-router-dom";
import { NAV_CONFIG, type NavItem } from "@/lib/nav-config";
import { resolveActiveItem } from "@/lib/active-match";
import { useLayoutStore } from "@/store/layout-store";
import { SidebarGroup } from "./SidebarGroup";

export function filterDevItems(items: readonly NavItem[], isDev: boolean): NavItem[] {
  return items.filter((item) => !item.devOnly || isDev);
}

export function SidebarNav() {
  const { pathname } = useLocation();
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);

  return (
    <nav aria-label="Navegación principal" className="flex flex-col gap-4 p-2">
      {NAV_CONFIG.map((group) => {
        const visibleItems = filterDevItems(group.items, import.meta.env.DEV);
        const activeItemId = resolveActiveItem(pathname, visibleItems);
        return (
          <SidebarGroup
            key={group.id}
            group={group}
            visibleItems={visibleItems}
            activeItemId={activeItemId}
            collapsed={collapsed}
          />
        );
      })}
    </nav>
  );
}
