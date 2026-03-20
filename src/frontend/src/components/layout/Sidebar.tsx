"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Building2,
  UserCheck,
  Briefcase,
  FileText,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/authStore";
import { authService } from "@/services/authService";
import { toast } from "sonner";
import type { UserRole } from "@/types/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "manager", "account_executive"],
  },
  {
    label: "Clientes",
    href: "/clients",
    icon: Building2,
    roles: ["admin", "manager", "account_executive"],
  },
  {
    label: "Candidatos",
    href: "/candidates",
    icon: UserCheck,
    roles: ["admin", "manager", "account_executive", "recruiter"],
  },
  {
    label: "Colocaciones",
    href: "/placements",
    icon: Briefcase,
    roles: ["admin", "manager", "account_executive"],
  },
  {
    label: "Facturas",
    href: "/invoices",
    icon: FileText,
    roles: ["admin", "manager"],
  },
  {
    label: "Usuarios",
    href: "/users",
    icon: Users,
    roles: ["admin"],
  },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  manager: "Gerente",
  account_executive: "Ejecutivo de cuenta",
  recruiter: "Reclutador",
};

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearUser } = useAuthStore();

  const visibleItems = NAV_ITEMS.filter(
    (item) => user?.role && item.roles.includes(user.role)
  );

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignorar errores en logout
    } finally {
      clearUser();
      router.push("/login");
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-r w-64">
      {/* Logo */}
      <div className="px-6 py-5">
        <span className="text-xl font-bold tracking-tight">BePro</span>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reclutamiento & Selección
        </p>
      </div>

      <Separator />

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Usuario y logout */}
      <div className="px-4 py-4 space-y-3">
        <div className="px-3">
          <p className="text-sm font-medium truncate">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {user?.role ? ROLE_LABELS[user.role] : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
