import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLayoutStore } from "@/store/layout-store";
import { SidebarNav } from "./SidebarNav";
import { SidebarCollapseButton } from "./SidebarCollapseButton";

export function Sidebar() {
  const collapsed = useLayoutStore((s) => s.sidebarCollapsed);

  return (
    <aside
      data-slot="sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-card h-[calc(100dvh-var(--header-height,3.5rem))] sticky top-[var(--header-height,3.5rem)]",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <ScrollArea className="flex-1">
        <SidebarNav />
      </ScrollArea>
      <Separator />
      <div
        className={cn(
          "flex items-center p-2",
          collapsed ? "justify-center" : "justify-end",
        )}
      >
        <SidebarCollapseButton />
      </div>
    </aside>
  );
}
