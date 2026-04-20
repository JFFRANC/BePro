import { TenantBadge } from "./TenantBadge";

export function Header() {
  return (
    <header
      data-slot="header"
      className="sticky top-0 z-40 grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border bg-background/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 h-14"
    >
      <div data-slot="header-left" className="flex items-center gap-3 min-w-0">
        <TenantBadge />
      </div>
      <div data-slot="header-center" className="flex items-center justify-center">
        {/* Reservado para Phase 9: SearchTrigger */}
      </div>
      <div
        data-slot="header-right"
        className="flex items-center justify-end gap-2"
      >
        {/* Reservado para Phase 7 (ThemeToggle) y Phase 9 (NotificationsBell, UserMenu) */}
      </div>
    </header>
  );
}
