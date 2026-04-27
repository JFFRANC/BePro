// 008-ux-roles-refinements / US1 — Header user menu with avatar + logout.
// FR-HD-001/002/003/004 satisfied here; FR-HD-004 fallback is initials tile.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon } from "lucide-react";

const ROLE_LABELS_ES: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  account_executive: "Ejecutivo de cuenta",
  recruiter: "Reclutador",
};

function initialsFrom(firstName?: string, lastName?: string, email?: string) {
  const first = firstName?.trim().charAt(0).toUpperCase() ?? "";
  const last = lastName?.trim().charAt(0).toUpperCase() ?? "";
  if (first || last) return `${first}${last}` || first;
  if (email) {
    return email.trim().charAt(0).toUpperCase() || "?";
  }
  return "?";
}

function displayName(user: {
  firstName?: string;
  lastName?: string;
  email: string;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email;
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) return null;

  const initials = initialsFrom(user.firstName, user.lastName, user.email);
  const name = displayName(user);
  const secondary = ROLE_LABELS_ES[user.role] ?? user.email;

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      // `logout()` revokes the refresh token, clears Zustand auth state, and
      // the subsequent navigation aborts in-flight protected requests (they
      // will 401 out). This keeps the component tree free of a hard QueryClient
      // dependency so existing Header/AppShellLayout tests keep passing.
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(triggerProps) => (
          <Button
            {...triggerProps}
            variant="ghost"
            className="h-9 gap-2 px-2"
            aria-label="Abrir menú de usuario"
            data-slot="user-menu-trigger"
          >
            <Avatar size="sm" aria-hidden="true">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline-flex flex-col items-start text-left leading-tight">
              <span className="text-sm font-medium">{name}</span>
              <span className="text-xs text-muted-foreground">{secondary}</span>
            </span>
          </Button>
        )}
      />
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-56">
        <div
          className="flex flex-col px-2 py-1.5"
          data-slot="user-menu-label"
        >
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground truncate">
            {user.email}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled
          aria-disabled="true"
          className="gap-2 text-muted-foreground"
        >
          <UserIcon className="h-4 w-4" aria-hidden="true" />
          Mi perfil (próximamente)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {isLoggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
