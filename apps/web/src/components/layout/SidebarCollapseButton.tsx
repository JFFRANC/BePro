import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayoutStore } from "@/store/layout-store";

export function SidebarCollapseButton() {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);

  const Icon = collapsed ? ChevronRight : ChevronLeft;
  const label = collapsed ? "Expandir menú lateral" : "Contraer menú lateral";

  return (
    <Button
      data-slot="sidebar-collapse-button"
      variant="ghost"
      size="icon-sm"
      aria-expanded={!collapsed}
      aria-label={label}
      onClick={toggleSidebar}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
