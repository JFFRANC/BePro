import {
  Briefcase,
  Building2,
  CalendarCheck,
  Contact,
  Handshake,
  LayoutDashboard,
  Palette,
  ScrollText,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@bepro/shared";
import type { Actions, Subjects } from "@/lib/ability";

export type NavGate =
  | { kind: "ability"; action: Actions; subject: Subjects }
  | { kind: "roles"; roles: UserRole[] };

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  gate: NavGate;
  exactMatch?: boolean;
  devOnly?: boolean;
}

export interface NavGroup {
  id: string;
  label?: string;
  gate?: NavGate;
  items: NavItem[];
}

const ALL_ROLES: UserRole[] = ["admin", "manager", "account_executive", "recruiter"];
const ADMIN_MANAGER: UserRole[] = ["admin", "manager"];
const ADMIN_MANAGER_AE: UserRole[] = ["admin", "manager", "account_executive"];
const ADMIN_ONLY: UserRole[] = ["admin"];

const config: NavGroup[] = [
  {
    id: "principal",
    label: "Principal",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        path: "/",
        icon: LayoutDashboard,
        gate: { kind: "roles", roles: ALL_ROLES },
        exactMatch: true,
      },
    ],
  },
  {
    id: "reclutamiento",
    label: "Reclutamiento",
    items: [
      {
        id: "candidates",
        label: "Candidatos",
        path: "/candidates",
        icon: Users,
        gate: { kind: "ability", action: "read", subject: "Candidate" },
      },
      {
        id: "job-openings",
        label: "Vacantes",
        path: "/job-openings",
        icon: Briefcase,
        gate: { kind: "roles", roles: ALL_ROLES },
      },
      {
        id: "interviews",
        label: "Entrevistas",
        path: "/interviews",
        icon: CalendarCheck,
        gate: { kind: "roles", roles: ALL_ROLES },
      },
      {
        id: "placements",
        label: "Colocaciones",
        path: "/placements",
        icon: Handshake,
        gate: { kind: "ability", action: "read", subject: "Placement" },
      },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    items: [
      {
        id: "clients",
        label: "Empresas cliente",
        path: "/clients",
        icon: Building2,
        gate: { kind: "ability", action: "read", subject: "Client" },
      },
      {
        id: "contacts",
        label: "Contactos",
        path: "/contacts",
        icon: Contact,
        gate: { kind: "roles", roles: ADMIN_MANAGER_AE },
      },
    ],
  },
  {
    id: "administracion",
    label: "Administración",
    gate: { kind: "roles", roles: ADMIN_MANAGER },
    items: [
      {
        id: "users",
        label: "Usuarios",
        path: "/users",
        icon: UserCog,
        gate: { kind: "ability", action: "manage", subject: "User" },
      },
      {
        id: "settings",
        label: "Configuración",
        path: "/settings",
        icon: Settings,
        gate: { kind: "roles", roles: ADMIN_ONLY },
      },
      {
        id: "audit",
        label: "Auditoría",
        path: "/audit",
        icon: ScrollText,
        gate: { kind: "ability", action: "read", subject: "Audit" },
      },
    ],
  },
  {
    id: "dev",
    items: [
      {
        id: "design-system",
        label: "Design system",
        path: "/design-system",
        icon: Palette,
        gate: { kind: "roles", roles: ALL_ROLES },
        devOnly: true,
      },
    ],
  },
];

export const NAV_CONFIG: readonly NavGroup[] = Object.freeze(config);
