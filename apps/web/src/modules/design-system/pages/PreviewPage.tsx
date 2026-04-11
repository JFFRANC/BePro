import { useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import type { IClientFormConfig } from "@bepro/shared";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { DatePicker } from "@/components/date-picker";
import { useConfirm } from "@/components/confirm-dialog";
import { DynamicCandidateForm } from "@/components/dynamic-form";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarBadge } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { DataTable, DataTableColumnHeader } from "@/components/data-table";
import { Combobox } from "@/components/combobox";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import {
  Users,
  Calendar,
  Briefcase,
  Mail,
  Lock,
  Building2,
  ArrowUpRight,
  Search,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Share2,
  MoreHorizontal,
  UserCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  PanelRightOpen,
  ChevronsUpDown,
  ShieldAlert,
  SearchX,
  ServerCrash,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/components/section-shell";
import { SectionHeader } from "@/components/section-header";
import { StatCard } from "@/components/stat-card";
import { ThemeToggle } from "@/components/theme-toggle";

/* ---------- Data ---------- */

const BADGE_GROUPS = [
  {
    title: "Progreso",
    description: "Candidatos en proceso activo",
    items: [
      { variant: "status-registered" as const, label: "Registrado", name: "Maria Lopez" },
      { variant: "status-interview-scheduled" as const, label: "Entrevista", name: "Carlos Ruiz" },
      { variant: "status-attended" as const, label: "Asistio", name: "Ana Torres" },
      { variant: "status-pending" as const, label: "Pendiente", name: "Luis Garcia" },
    ],
  },
  {
    title: "Exito",
    description: "Candidatos colocados o aprobados",
    items: [
      { variant: "status-approved" as const, label: "Aprobado", name: "Sofia Hernandez" },
      { variant: "status-hired" as const, label: "Contratado", name: "Diego Martinez" },
      { variant: "status-in-guarantee" as const, label: "En Garantia", name: "Valentina Cruz" },
      { variant: "status-guarantee-met" as const, label: "Garantia OK", name: "Mateo Reyes" },
    ],
  },
  {
    title: "Negativo",
    description: "Rechazos, declinaciones, ausencias",
    items: [
      { variant: "status-rejected" as const, label: "Rechazado", name: "Pedro Sanchez" },
      { variant: "status-declined" as const, label: "Declinado", name: "Laura Mendoza" },
      { variant: "status-no-show" as const, label: "No Asistio", name: "Ricardo Flores" },
      { variant: "status-termination" as const, label: "Terminacion", name: "Carmen Vega" },
    ],
  },
  {
    title: "Terminal",
    description: "Estados finales sin accion",
    items: [
      { variant: "status-discarded" as const, label: "Descartado", name: "Jorge Ramos" },
      { variant: "status-replacement" as const, label: "Reemplazo", name: "Elena Diaz" },
    ],
  },
];

const SEMANTIC_COLORS = [
  { name: "Primary", token: "--primary", bg: "bg-primary", fg: "text-primary-foreground", desc: "Acciones principales, CTA" },
  { name: "Secondary", token: "--secondary", bg: "bg-secondary", fg: "text-secondary-foreground", desc: "Acciones secundarias" },
  { name: "Destructive", token: "--destructive", bg: "bg-destructive", fg: "text-destructive-foreground", desc: "Eliminar, peligro" },
  { name: "Success", token: "--success", bg: "bg-success", fg: "text-success-foreground", desc: "Confirmacion, exito" },
  { name: "Warning", token: "--warning", bg: "bg-warning", fg: "text-warning-foreground", desc: "Precaucion, atencion" },
  { name: "Info", token: "--info", bg: "bg-info", fg: "text-info-foreground", desc: "Informacion, contexto" },
];

const SURFACE_COLORS = [
  { name: "Background", bg: "bg-background", border: "border-border" },
  { name: "Card", bg: "bg-card", border: "border-border" },
  { name: "Muted", bg: "bg-muted", border: "border-border" },
  { name: "Accent", bg: "bg-accent", border: "border-border" },
  { name: "Sidebar", bg: "bg-sidebar", border: "border-sidebar-border" },
];

const CHART_BARS = [
  { c: "bg-chart-1", h: "100%", label: "Chart 1", pct: "100%" },
  { c: "bg-chart-2", h: "75%", label: "Chart 2", pct: "75%" },
  { c: "bg-chart-3", h: "88%", label: "Chart 3", pct: "88%" },
  { c: "bg-chart-4", h: "60%", label: "Chart 4", pct: "60%" },
  { c: "bg-chart-5", h: "45%", label: "Chart 5", pct: "45%" },
];

const DASHBOARD_CARDS = [
  {
    label: "Candidatos Activos",
    value: "142",
    trend: "+12% vs. mes anterior",
    trendColor: "text-success",
    icon: Users,
    borderColor: "border-t-primary",
    valueColor: "text-primary",
    iconBg: "bg-primary/10 text-primary",
    showTrendIcon: true,
  },
  {
    label: "Entrevistas Hoy",
    value: "8",
    trend: "3 por confirmar",
    trendColor: "text-warning",
    icon: Calendar,
    borderColor: "border-t-warning",
    valueColor: "text-warning",
    iconBg: "bg-warning/10 text-warning",
    showTrendIcon: false,
  },
  {
    label: "Colocaciones Q1",
    value: "24",
    trend: "18 en garantia activa",
    trendColor: "text-success",
    icon: Briefcase,
    borderColor: "border-t-success",
    valueColor: "text-success",
    iconBg: "bg-success/10 text-success",
    showTrendIcon: true,
  },
  {
    label: "Busquedas Abiertas",
    value: "7",
    trend: "3 clientes nuevos",
    trendColor: "text-info",
    icon: Search,
    borderColor: "border-t-info",
    valueColor: "text-info",
    iconBg: "bg-info/10 text-info",
    showTrendIcon: false,
  },
];

const RADIUS_SCALE = [
  { name: "sm", label: "0.3rem", tw: "rounded-sm" },
  { name: "md", label: "0.4rem", tw: "rounded-md" },
  { name: "lg", label: "0.5rem", tw: "rounded-lg" },
  { name: "xl", label: "0.7rem", tw: "rounded-xl" },
  { name: "2xl", label: "0.9rem", tw: "rounded-2xl" },
  { name: "3xl", label: "1.1rem", tw: "rounded-3xl" },
];

/* ---------- DataTable sample data ---------- */

interface SampleCandidate {
  id: string;
  name: string;
  email: string;
  client: string;
  status: string;
  statusVariant:
    | "status-registered"
    | "status-interview-scheduled"
    | "status-attended"
    | "status-pending"
    | "status-approved"
    | "status-hired"
    | "status-rejected"
    | "status-declined";
  date: string;
}

const SAMPLE_CANDIDATES: SampleCandidate[] = [
  { id: "1", name: "Maria Lopez", email: "maria@ejemplo.com", client: "Empresa A", status: "Registrado", statusVariant: "status-registered", date: "2026-03-28" },
  { id: "2", name: "Carlos Ruiz", email: "carlos@ejemplo.com", client: "Empresa B", status: "Entrevista", statusVariant: "status-interview-scheduled", date: "2026-03-27" },
  { id: "3", name: "Ana Torres", email: "ana@ejemplo.com", client: "Empresa A", status: "Asistio", statusVariant: "status-attended", date: "2026-03-26" },
  { id: "4", name: "Luis Garcia", email: "luis@ejemplo.com", client: "Empresa C", status: "Pendiente", statusVariant: "status-pending", date: "2026-03-25" },
  { id: "5", name: "Sofia Hernandez", email: "sofia@ejemplo.com", client: "Empresa D", status: "Aprobado", statusVariant: "status-approved", date: "2026-03-24" },
  { id: "6", name: "Diego Martinez", email: "diego@ejemplo.com", client: "Empresa B", status: "Contratado", statusVariant: "status-hired", date: "2026-03-23" },
  { id: "7", name: "Valentina Cruz", email: "valentina@ejemplo.com", client: "Empresa A", status: "Rechazado", statusVariant: "status-rejected", date: "2026-03-22" },
  { id: "8", name: "Mateo Reyes", email: "mateo@ejemplo.com", client: "Empresa C", status: "Declinado", statusVariant: "status-declined", date: "2026-03-21" },
];

const CANDIDATE_COLUMNS: ColumnDef<SampleCandidate>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
  },
  {
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
  },
  {
    accessorKey: "client",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.statusVariant}>{row.original.status}</Badge>
    ),
  },
  {
    accessorKey: "date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
  },
];

/* ---------- Sub-components (need hooks) ---------- */

function DatePickerSection() {
  const [date, setDate] = useState<Date | undefined>();

  return (
    <SectionShell>
      <SectionHeader
        title="DatePicker"
        description="Selector de fecha con calendario emergente y formato localizado en espanol"
      />
      <div className="max-w-sm space-y-2">
        <Label>Fecha de entrevista</Label>
        <DatePicker
          value={date}
          onChange={setDate}
          placeholder="Seleccionar fecha de entrevista"
        />
        {date && (
          <p className="text-xs text-muted-foreground">
            Seleccionada: {date.toLocaleDateString("es-MX", { dateStyle: "long" })}
          </p>
        )}
      </div>
    </SectionShell>
  );
}

function ConfirmDialogSection() {
  const confirm = useConfirm();

  async function handleConfirm() {
    const ok = await confirm({
      title: "Confirmar accion",
      description: "Esta a punto de confirmar esta operacion. Desea continuar?",
      confirmLabel: "Confirmar",
      icon: CircleAlert,
    });
    if (ok) {
      toast.success("Accion confirmada");
    }
  }

  async function handleReject() {
    const ok = await confirm({
      title: "Rechazar candidato",
      description: "El candidato sera marcado como rechazado y no podra continuar en el proceso. Esta accion puede revertirse.",
      confirmLabel: "Rechazar",
      variant: "destructive",
      icon: XCircle,
    });
    if (ok) {
      toast.success("Candidato rechazado (demo)");
    }
  }

  return (
    <SectionShell>
      <SectionHeader
        title="ConfirmDialog"
        description="Dialogos de confirmacion imperativa via useConfirm() — variantes default y destructive"
      />
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleConfirm}>
          <CheckCircle className="size-4" data-icon="inline-start" />
          Confirmar accion
        </Button>
        <Button variant="destructive" onClick={handleReject}>
          <XCircle className="size-4" data-icon="inline-start" />
          Rechazar candidato
        </Button>
      </div>
    </SectionShell>
  );
}

/* ---------- Main Page ---------- */

export function PreviewPage() {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Dot-grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035] dark:opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Floating dark-mode toggle */}
      <ThemeToggle />

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-tl from-info/5 via-transparent to-primary/5" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-info/8 blur-[100px] translate-y-1/2 -translate-x-1/4" />

        <div className="page-container relative py-20 sm:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary mb-6">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              v1.0 — OKLch + Tailwind v4
            </div>
            <h1 className="!text-5xl sm:!text-6xl !leading-[1.05] tracking-tight">
              BePro{" "}
              <span className="text-primary">Design System</span>
            </h1>
            <p className="text-lg text-muted-foreground mt-4 max-w-lg leading-relaxed">
              Tokens, componentes y patrones visuales para la plataforma de
              reclutamiento mas utilizada en Mexico.
            </p>
            <div className="flex items-center gap-3 mt-8">
              <Badge variant="default">Fraunces</Badge>
              <Badge variant="secondary">Source Sans 3</Badge>
              <Badge variant="outline">shadcn/ui</Badge>
              <Badge variant="outline">14 estados FSM</Badge>
            </div>
          </div>

          {/* Floating candidate preview card */}
          <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2">
            <div className="rotate-2 rounded-xl border border-border/60 bg-card/90 backdrop-blur-md shadow-xl p-4 w-64">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">Sofia H.</span>
                  <Badge variant="status-hired">Contratado</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">Carlos R.</span>
                  <Badge variant="status-pending">Pendiente</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">Laura M.</span>
                  <Badge variant="status-rejected">Rechazado</Badge>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-3">
                <span className="text-3xl font-bold font-heading text-primary">142</span>
                <span className="text-xs text-muted-foreground leading-tight">
                  Candidatos<br />activos
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="page-container pb-20 space-y-10 mt-4">
        {/* --- Color Palette --- */}
        <SectionShell>
          <SectionHeader
            title="Paleta de Colores"
            description="Colores semanticos en OKLch — perceptualmente uniformes, accesibles WCAG AA"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {SEMANTIC_COLORS.map((c) => {
              const needsRing = c.name === "Secondary" || c.name === "Accent";
              return (
                <div key={c.name} className="group">
                  <div
                    className={cn(
                      c.bg,
                      c.fg,
                      "h-24 rounded-xl flex items-end p-3 transition-transform group-hover:scale-[1.03] group-hover:shadow-lg",
                      needsRing && "ring-1 ring-inset ring-foreground/10",
                    )}
                  >
                    <span className="text-sm font-semibold">{c.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    {c.token}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Superficies
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {SURFACE_COLORS.map((s) => (
                <div
                  key={s.name}
                  className={cn(
                    s.bg,
                    s.border,
                    "border rounded-lg h-14 flex items-center justify-center text-xs text-muted-foreground font-medium",
                  )}
                >
                  {s.name}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Graficos
            </h3>
            <div className="flex gap-1.5 h-24 items-end">
              {CHART_BARS.map((bar, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {bar.pct}
                  </span>
                  <div
                    className={cn(
                      bar.c,
                      "w-full rounded-t-md transition-all hover:opacity-80",
                    )}
                    style={{ height: bar.h }}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 truncate max-w-full">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionShell>

        {/* --- Typography --- */}
        <SectionShell>
          <SectionHeader
            title="Tipografia"
            description="Fraunces (headings) + Source Sans 3 (body) — escala modular 1.25"
          />

          <div className="grid lg:grid-cols-[1fr_280px] gap-8">
            <div className="space-y-6">
              {[
                { tag: "h1", label: "Display", size: "2.441rem", weight: "700", example: "Gestion de Talento" },
                { tag: "h2", label: "Heading", size: "1.953rem", weight: "600", example: "Panel de Reclutamiento" },
                { tag: "h3", label: "Subheading", size: "1.563rem", weight: "600", example: "Candidatos Activos" },
                { tag: "h4", label: "Section", size: "1.25rem", weight: "600", example: "Detalles del Candidato" },
              ].map((item) => (
                <div key={item.tag} className="group flex items-baseline gap-4 border-b border-border/40 pb-4">
                  <span className="text-xs font-mono text-muted-foreground w-8 shrink-0 uppercase">
                    {item.tag}
                  </span>
                  {item.tag === "h1" && <h1 className="!m-0">{item.example}</h1>}
                  {item.tag === "h2" && <h2 className="!m-0">{item.example}</h2>}
                  {item.tag === "h3" && <h3 className="!m-0">{item.example}</h3>}
                  {item.tag === "h4" && <h4 className="!m-0">{item.example}</h4>}
                  <span className="text-xs text-muted-foreground font-mono ml-auto hidden sm:block">
                    {item.size} / {item.weight}
                  </span>
                </div>
              ))}

              <div className="space-y-3 pt-2">
                <div className="flex items-baseline gap-4">
                  <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">body</span>
                  <p className="!m-0">
                    Texto de cuerpo para parrafos y contenido general de la plataforma de reclutamiento.
                  </p>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">sm</span>
                  <p className="text-sm !m-0 text-muted-foreground">
                    Texto auxiliar para metadatos, fechas y notas secundarias.
                  </p>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">cap</span>
                  <p
                    className="!m-0 text-muted-foreground uppercase tracking-widest"
                    style={{ fontSize: "0.64rem", lineHeight: 1.4, fontWeight: 500 }}
                  >
                    Etiqueta de caption
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/40 bg-muted/30 p-5 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Font Stack
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-heading text-2xl text-primary">Aa</span>
                  <div>
                    <p className="text-sm font-semibold">Fraunces</p>
                    <p className="text-xs text-muted-foreground">Headings — Variable serif</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl text-primary">Aa</span>
                  <div>
                    <p className="text-sm font-semibold">Source Sans 3</p>
                    <p className="text-xs text-muted-foreground">Body — Humanist sans</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* --- Badges: FSM States --- */}
        <SectionShell>
          <SectionHeader
            title="Badges — Estados FSM"
            description="14 estados del ciclo de vida de candidatos, agrupados por significado semantico"
          />

          <div className="space-y-6">
            {BADGE_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="!text-sm !font-semibold">{group.title}</h4>
                  <span className="text-xs text-muted-foreground">
                    — {group.description}
                  </span>
                </div>
                <div className="rounded-lg border border-border/40 overflow-hidden">
                  {group.items.map((item, i) => (
                    <div
                      key={item.variant}
                      className={cn(
                        "flex items-center justify-between px-3 py-3 sm:px-4 sm:py-2.5 text-sm",
                        i !== group.items.length - 1 && "border-b border-border/30",
                        "hover:bg-muted/40 transition-colors",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Users className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </div>
                      <Badge variant={item.variant}>{item.label}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <h4 className="!text-sm !font-semibold mb-3">Estandar</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="destructive">Destructive</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="ghost">Ghost</Badge>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* --- Buttons --- */}
        <SectionShell>
          <SectionHeader
            title="Botones"
            description="8 variantes semanticas con 4 tamanos y estados interactivos"
          />

          <div className="space-y-8">
            <div>
              <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Variantes
              </h4>
              <div className="flex flex-wrap gap-3">
                <Button variant="default">
                  <Briefcase className="size-4" data-icon="inline-start" />
                  Primary
                </Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
                <Button variant="success">
                  Success
                  <ArrowUpRight className="size-3.5" data-icon="inline-end" />
                </Button>
                <Button variant="warning">Warning</Button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-8">
              <div>
                <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Tamanos
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="xs">Extra Small</Button>
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>
              <div>
                <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Estados
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled>Disabled</Button>
                  <Button variant="outline" disabled>
                    Outline Disabled
                  </Button>
                  <Button variant="success" disabled>
                    Success Disabled
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* --- Inputs --- */}
        <SectionShell>
          <SectionHeader
            title="Inputs"
            description="Campos de formulario con estados de error, foco y deshabilitado"
          />

          <div className="max-w-lg">
            <div className="rounded-xl border border-border/40 bg-card p-6 space-y-5">
              <h4 className="!text-base !font-semibold">Registro de Candidato</h4>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Nombre completo</label>
                  <div className="relative">
                    <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Maria Lopez Torres" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input error className="pl-9" placeholder="correo@ejemplo.com" />
                  </div>
                  <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
                    Email es requerido
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input className="pl-9" disabled placeholder="Se asigna automaticamente" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Contrasena</label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input className="pl-9" type="password" placeholder="••••••••" />
                  </div>
                </div>
                <Button className="w-full">
                  Registrar candidato
                  <ChevronRight className="size-4" data-icon="inline-end" />
                </Button>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* --- Cards (Dashboard Widgets) --- */}
        <SectionShell>
          <SectionHeader
            title="Cards"
            description="Widgets de dashboard con metricas y tendencias en tiempo real"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DASHBOARD_CARDS.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
        </SectionShell>

        {/* --- Layout Patterns --- */}
        <SectionShell>
          <SectionHeader
            title="Layout Patterns"
            description="Patrones responsivos para autenticacion y dashboard"
          />

          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Auth — Split Screen
              </h4>
              <div className="auth-layout rounded-xl border border-border/40 overflow-hidden h-40 sm:h-48">
                <div className="bg-gradient-to-br from-primary to-primary/70 flex flex-col items-center justify-center text-primary-foreground p-4 gap-2">
                  <span className="font-heading text-xl font-bold">BePro</span>
                  <span className="text-xs opacity-80">Reclutamiento inteligente</span>
                </div>
                <div className="bg-card flex flex-col items-center justify-center p-4 gap-3">
                  <div className="w-full max-w-[160px] space-y-2">
                    <div className="h-2 rounded bg-muted w-full" />
                    <div className="h-6 rounded bg-muted/60 w-full" />
                    <div className="h-6 rounded bg-muted/60 w-full" />
                    <div className="h-6 rounded bg-primary w-full" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Dashboard — Sidebar + Content
              </h4>
              <div className="dashboard-layout rounded-xl border border-border/40 overflow-hidden h-40 sm:h-48">
                <div className="bg-sidebar border-r border-sidebar-border p-3 space-y-1.5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-5 rounded bg-sidebar-primary" />
                    <div className="h-2 rounded bg-sidebar-foreground/20 w-12" />
                  </div>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-5 rounded px-2 flex items-center",
                        i === 2
                          ? "bg-sidebar-accent"
                          : "hover:bg-sidebar-accent/50",
                      )}
                    >
                      <div
                        className={cn(
                          "h-1.5 rounded w-full",
                          i === 2
                            ? "bg-sidebar-accent-foreground/30"
                            : "bg-sidebar-foreground/10",
                        )}
                      />
                    </div>
                  ))}
                </div>
                <div className="bg-background p-3">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-10 rounded-md border border-border/40 bg-card"
                      />
                    ))}
                  </div>
                  <div className="h-16 rounded-md border border-border/40 bg-card" />
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* --- Border Radius --- */}
        <SectionShell>
          <SectionHeader
            title="Border Radius"
            description="Escala de radios derivada del token base --radius: 0.5rem"
          />
          <div className="flex flex-wrap gap-4">
            {RADIUS_SCALE.map((r) => (
              <div key={r.name} className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    r.tw,
                    "size-20 bg-card border-2 border-primary/30 transition-transform hover:scale-110 flex items-center justify-center p-2 shadow-sm",
                  )}
                >
                  <div
                    className={cn(
                      r.tw,
                      "size-8 bg-primary/15 border border-primary/20",
                    )}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {r.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionShell>

        {/* --- DataTable --- */}
        <SectionShell>
          <SectionHeader
            title="DataTable"
            description="Tabla de datos con ordenamiento por columna y paginacion integrada"
          />
          <DataTable columns={CANDIDATE_COLUMNS} data={SAMPLE_CANDIDATES} pageSize={5} />
        </SectionShell>

        {/* --- Dialog & AlertDialog --- */}
        <SectionShell>
          <SectionHeader
            title="Dialog & AlertDialog"
            description="Modales para formularios y confirmaciones destructivas"
          />
          <div className="flex flex-wrap gap-4">
            <Dialog>
              <DialogTrigger
                render={
                  <Button>
                    <Plus className="size-4" data-icon="inline-start" />
                    Crear Candidato
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nuevo Candidato</DialogTitle>
                  <DialogDescription>
                    Completa los datos para registrar un candidato en el sistema.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="dialog-name" className="mb-1.5">Nombre completo</Label>
                    <Input id="dialog-name" placeholder="Maria Lopez Torres" />
                  </div>
                  <div>
                    <Label htmlFor="dialog-email" className="mb-1.5">Email</Label>
                    <Input id="dialog-email" type="email" placeholder="correo@ejemplo.com" />
                  </div>
                </div>
                <DialogFooter showCloseButton>
                  <Button>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="destructive">
                    <Trash2 className="size-4" data-icon="inline-start" />
                    Eliminar
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Desactivar candidato</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta accion desactivara al candidato del sistema. Podra ser reactivado
                    posteriormente por un administrador.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction variant="destructive">
                    Confirmar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SectionShell>

        {/* --- Select --- */}
        <SectionShell>
          <SectionHeader
            title="Select"
            description="Menus desplegables para seleccion de opciones"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg">
            <div>
              <Label className="mb-1.5">Cliente</Label>
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a">Empresa A</SelectItem>
                  <SelectItem value="b">Empresa B</SelectItem>
                  <SelectItem value="c">Empresa C</SelectItem>
                  <SelectItem value="d">Empresa D</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5">Estado</Label>
              <Select>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registered">Registrado</SelectItem>
                  <SelectItem value="interview">Entrevista</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="hired">Contratado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionShell>

        {/* --- DropdownMenu --- */}
        <SectionShell>
          <SectionHeader
            title="DropdownMenu"
            description="Menus contextuales con submenus y acciones destructivas"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  <MoreHorizontal className="size-4" data-icon="inline-start" />
                  Acciones
                </Button>
              }
            />
            <DropdownMenuContent>
              <DropdownMenuItem>
                <UserCircle className="size-4" />
                Ver perfil
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Cambiar estado
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Registrado</DropdownMenuItem>
                  <DropdownMenuItem>Entrevista</DropdownMenuItem>
                  <DropdownMenuItem>Aprobado</DropdownMenuItem>
                  <DropdownMenuItem>Contratado</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 className="size-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SectionShell>

        {/* --- Tabs --- */}
        <SectionShell>
          <SectionHeader
            title="Tabs"
            description="Navegacion por pestanas para organizar contenido relacionado"
          />
          <div className="max-w-lg">
            <Tabs defaultValue="perfil">
              <TabsList>
                <TabsTrigger value="perfil">Perfil</TabsTrigger>
                <TabsTrigger value="entrevistas">Entrevistas</TabsTrigger>
                <TabsTrigger value="colocaciones">Colocaciones</TabsTrigger>
              </TabsList>
              <TabsContent value="perfil" className="mt-4 rounded-lg border border-border/40 p-4">
                <h4 className="!text-sm !font-semibold mb-2">Datos del Candidato</h4>
                <p className="text-sm text-muted-foreground">
                  Informacion personal, datos de contacto y documentos del candidato.
                  Incluye nombre, telefono, email y referencias laborales.
                </p>
              </TabsContent>
              <TabsContent value="entrevistas" className="mt-4 rounded-lg border border-border/40 p-4">
                <h4 className="!text-sm !font-semibold mb-2">Historial de Entrevistas</h4>
                <p className="text-sm text-muted-foreground">
                  Registro de entrevistas programadas y realizadas. Incluye fecha,
                  hora, entrevistador y resultado de cada entrevista.
                </p>
              </TabsContent>
              <TabsContent value="colocaciones" className="mt-4 rounded-lg border border-border/40 p-4">
                <h4 className="!text-sm !font-semibold mb-2">Historial de Colocaciones</h4>
                <p className="text-sm text-muted-foreground">
                  Registro de colocaciones del candidato en empresas cliente.
                  Incluye empresa, puesto, fecha de inicio y estado de garantia.
                </p>
              </TabsContent>
            </Tabs>
          </div>
        </SectionShell>

        {/* --- Avatar --- */}
        <SectionShell>
          <SectionHeader
            title="Avatar"
            description="Representacion visual de usuarios con iniciales, tamanos y estado"
          />
          <div className="flex items-end gap-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar size="sm">
                <AvatarFallback>ML</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">sm</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar>
                <AvatarFallback>CR</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">default</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar size="lg">
                <AvatarFallback>AT</AvatarFallback>
                <AvatarBadge />
              </Avatar>
              <span className="text-xs text-muted-foreground">lg + badge</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Avatar size="lg">
                <AvatarFallback>SH</AvatarFallback>
                <AvatarBadge className="bg-success" />
              </Avatar>
              <span className="text-xs text-muted-foreground">lg + online</span>
            </div>
          </div>
        </SectionShell>

        {/* --- Skeleton --- */}
        <SectionShell>
          <SectionHeader
            title="Skeleton"
            description="Estados de carga placeholder para mejorar la percepcion de velocidad"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Card
              </h4>
              <div className="rounded-xl border border-border/40 p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <div>
              <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Fila de tabla
              </h4>
              <div className="flex items-center gap-3 rounded-xl border border-border/40 p-4">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div>
              <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Avatar + texto
              </h4>
              <div className="flex items-center gap-3 rounded-xl border border-border/40 p-4">
                <Skeleton className="size-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            </div>
          </div>
        </SectionShell>

        {/* --- Breadcrumb --- */}
        <SectionShell>
          <SectionHeader
            title="Breadcrumb"
            description="Navegacion jerarquica para orientar al usuario en la estructura"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Candidatos</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Maria Lopez</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </SectionShell>

        {/* --- Tooltip --- */}
        <SectionShell>
          <SectionHeader
            title="Tooltip"
            description="Textos emergentes informativos al hacer hover sobre elementos interactivos"
          />
          <TooltipProvider>
            <div className="flex gap-3">
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" size="icon-sm" />}>
                  <Pencil className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Editar candidato</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" size="icon-sm" />}>
                  <Trash2 className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Eliminar candidato</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger render={<Button variant="outline" size="icon-sm" />}>
                  <Share2 className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Compartir perfil</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </SectionShell>

        {/* --- Checkbox --- */}
        <SectionShell>
          <SectionHeader
            title="Checkbox"
            description="Controles de seleccion multiple con estados y etiquetas"
          />
          <div className="space-y-4 max-w-md">
            <div className="flex items-center gap-2">
              <Checkbox id="check-1" defaultChecked />
              <Label htmlFor="check-1">Disponible para turno matutino</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="check-2" />
              <Label htmlFor="check-2">Experiencia previa en manufactura</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="check-3" defaultChecked />
              <Label htmlFor="check-3">Acepto el aviso de privacidad (LFPDPPP)</Label>
            </div>
          </div>
        </SectionShell>

        {/* --- EmptyState --- */}
        <SectionShell>
          <SectionHeader
            title="EmptyState"
            description="Estado vacio para listas sin resultados o busquedas sin coincidencias"
          />
          <div className="rounded-xl border border-border/40">
            <EmptyState
              icon={Search}
              title="No se encontraron candidatos"
              description="Intenta ajustar los filtros de busqueda o registra un nuevo candidato para comenzar."
              action={
                <Button>
                  <Plus className="size-4" data-icon="inline-start" />
                  Registrar candidato
                </Button>
              }
            />
          </div>
        </SectionShell>

        {/* --- PageHeader --- */}
        <SectionShell>
          <SectionHeader
            title="PageHeader"
            description="Encabezado de pagina con titulo, descripcion, breadcrumb y accion principal"
          />
          <div className="rounded-xl border border-border/40 p-6">
            <PageHeader
              title="Candidatos"
              description="Gestiona el registro y seguimiento de candidatos para tus clientes"
              action={
                <Button>
                  <Plus className="size-4" data-icon="inline-start" />
                  Nuevo candidato
                </Button>
              }
            >
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Candidatos</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </PageHeader>
          </div>
        </SectionShell>

        {/* --- Toast --- */}
        <SectionShell>
          <SectionHeader
            title="Toast (Sonner)"
            description="Notificaciones efimeras para confirmar acciones del usuario"
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="success"
              onClick={() =>
                toast.success("Candidato registrado", {
                  description: "Maria Lopez se registro exitosamente.",
                })
              }
            >
              <CheckCircle className="size-4" data-icon="inline-start" />
              Success
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                toast.error("Error al guardar", {
                  description: "No se pudo completar la operacion. Intenta de nuevo.",
                })
              }
            >
              <XCircle className="size-4" data-icon="inline-start" />
              Error
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.info("Nueva entrevista", {
                  description: "Se programo una entrevista para el 5 de abril.",
                })
              }
            >
              <Info className="size-4" data-icon="inline-start" />
              Info
            </Button>
            <Button
              variant="warning"
              onClick={() =>
                toast.warning("Duplicado detectado", {
                  description: "Ya existe un candidato con este telefono para el cliente seleccionado.",
                })
              }
            >
              <AlertTriangle className="size-4" data-icon="inline-start" />
              Warning
            </Button>
          </div>
        </SectionShell>

        {/* --- Textarea --- */}
        <SectionShell>
          <SectionHeader
            title="Textarea"
            description="Campo de texto multilinea para comentarios y observaciones"
          />
          <div className="max-w-lg space-y-1.5">
            <Label htmlFor="textarea-demo">Observaciones del reclutador</Label>
            <Textarea
              id="textarea-demo"
              placeholder="Escribe tus notas sobre el candidato, resultados de la entrevista, o cualquier observacion relevante..."
            />
            <p className="text-xs text-muted-foreground">
              Maximo 500 caracteres. Esta informacion es visible solo para tu equipo.
            </p>
          </div>
        </SectionShell>

        {/* --- Separator --- */}
        <SectionShell>
          <SectionHeader
            title="Separator"
            description="Divisores horizontales y verticales para agrupar contenido"
          />
          <div className="max-w-lg space-y-6">
            <div>
              <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Horizontal
              </h4>
              <div className="space-y-3">
                <p className="text-sm">Informacion del candidato</p>
                <Separator />
                <p className="text-sm">Historial de entrevistas</p>
                <Separator />
                <p className="text-sm">Colocaciones</p>
              </div>
            </div>
            <div>
              <h4 className="!text-xs !font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Con etiqueta
              </h4>
              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground shrink-0">o continuar con</span>
                <Separator className="flex-1" />
              </div>
            </div>
          </div>
        </SectionShell>

        {/* --- Combobox / Autocomplete --- */}
        <SectionShell>
          <SectionHeader
            title="Combobox / Autocomplete"
            description="Busqueda con filtrado en tiempo real — escribe para filtrar opciones"
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Buscar candidato</Label>
              <Combobox
                options={[
                  { value: "maria-lopez", label: "Maria Lopez Torres" },
                  { value: "carlos-ruiz", label: "Carlos Ruiz Hernandez" },
                  { value: "ana-torres", label: "Ana Torres Mendoza" },
                  { value: "luis-garcia", label: "Luis Garcia Vega" },
                  { value: "sofia-hernandez", label: "Sofia Hernandez Cruz" },
                  { value: "diego-martinez", label: "Diego Martinez Reyes" },
                  { value: "valentina-cruz", label: "Valentina Cruz Flores" },
                  { value: "pedro-sanchez", label: "Pedro Sanchez Diaz" },
                ]}
                placeholder="Escribir nombre..."
                searchPlaceholder="Buscar candidato..."
                emptyMessage="No se encontro el candidato."
              />
              <p className="text-xs text-muted-foreground">8 candidatos disponibles</p>
            </div>

            <div className="space-y-2">
              <Label>Seleccionar cliente</Label>
              <Combobox
                options={[
                  { value: "oxxo", label: "OXXO" },
                  { value: "femsa", label: "FEMSA" },
                  { value: "cemex", label: "CEMEX" },
                  { value: "bimbo", label: "Grupo Bimbo" },
                  { value: "televisa", label: "Televisa" },
                  { value: "banorte", label: "Banorte" },
                ]}
                placeholder="Escribir empresa..."
                searchPlaceholder="Buscar cliente..."
                emptyMessage="Cliente no encontrado."
              />
              <p className="text-xs text-muted-foreground">Filtra escribiendo el nombre</p>
            </div>

            <div className="space-y-2">
              <Label>Municipio</Label>
              <Combobox
                options={[
                  { value: "monterrey", label: "Monterrey" },
                  { value: "guadalupe", label: "Guadalupe" },
                  { value: "san-nicolas", label: "San Nicolas de los Garza" },
                  { value: "apodaca", label: "Apodaca" },
                  { value: "escobedo", label: "General Escobedo" },
                  { value: "santa-catarina", label: "Santa Catarina" },
                  { value: "san-pedro", label: "San Pedro Garza Garcia" },
                  { value: "juarez", label: "Juarez" },
                ]}
                placeholder="Escribir municipio..."
                searchPlaceholder="Buscar municipio..."
                emptyMessage="Municipio no encontrado."
              />
              <p className="text-xs text-muted-foreground">Formulario dinamico (form_config)</p>
            </div>
          </div>
        </SectionShell>

        {/* --- Sheet --- */}
        <SectionShell>
          <SectionHeader
            title="Sheet"
            description="Panel lateral deslizable para mostrar detalles sin abandonar el contexto"
          />
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline">
                  <PanelRightOpen className="size-4" data-icon="inline-start" />
                  Ver detalle de candidato
                </Button>
              }
            />
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Detalle del candidato</SheetTitle>
                <SheetDescription>
                  Informacion completa del candidato seleccionado
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4">
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>ML</AvatarFallback>
                    <AvatarBadge className="bg-success" />
                  </Avatar>
                  <div>
                    <p className="font-medium">Maria Lopez Torres</p>
                    <p className="text-sm text-muted-foreground">maria@ejemplo.com</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estado</span>
                    <Badge variant="status-interview-scheduled">Entrevista</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium">Empresa A</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Puesto</span>
                    <span className="font-medium">Operador CNC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Telefono</span>
                    <span className="font-medium">81 1234 5678</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha entrevista</span>
                    <span className="font-medium">5 abr 2026</span>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </SectionShell>

        {/* --- Switch --- */}
        <SectionShell>
          <SectionHeader
            title="Switch"
            description="Controles de alternancia para configuraciones de cliente (form_config)"
          />
          <div className="max-w-sm space-y-4">
            {[
              { id: "switch-position", label: "Mostrar puesto", defaultChecked: true },
              { id: "switch-age", label: "Mostrar edad", defaultChecked: false },
              { id: "switch-shift", label: "Mostrar turno", defaultChecked: true },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-3">
                <Label htmlFor={item.id} className="cursor-pointer">{item.label}</Label>
                <Switch id={item.id} defaultChecked={item.defaultChecked} />
              </div>
            ))}
          </div>
        </SectionShell>

        {/* --- ScrollArea --- */}
        <SectionShell>
          <SectionHeader
            title="ScrollArea"
            description="Area de desplazamiento con scrollbar personalizado para listas largas"
          />
          <div className="max-w-sm">
            <ScrollArea className="h-[200px] rounded-lg border border-border/40">
              <div className="p-4 space-y-1">
                {[
                  "Maria Lopez Torres",
                  "Carlos Ruiz Hernandez",
                  "Ana Torres Mendoza",
                  "Luis Garcia Vega",
                  "Sofia Hernandez Cruz",
                  "Diego Martinez Reyes",
                  "Valentina Cruz Flores",
                  "Pedro Sanchez Diaz",
                  "Laura Mendoza Rios",
                  "Ricardo Flores Castillo",
                ].map((name, i) => (
                  <div
                    key={name}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                      i !== 9 && "border-b border-border/20",
                    )}
                  >
                    <Users className="size-3.5 text-muted-foreground shrink-0" />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </SectionShell>

        {/* --- Collapsible --- */}
        <SectionShell>
          <SectionHeader
            title="Collapsible"
            description="Secciones expandibles para contenido secundario u opcional"
          />
          <div className="max-w-lg">
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/40 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors [&[data-panel-open]>svg]:rotate-180">
                <span className="flex items-center gap-2">
                  <ChevronsUpDown className="size-4 text-muted-foreground" />
                  Datos adicionales
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-3 rounded-lg border border-border/40 p-4">
                <div className="space-y-2">
                  <Label htmlFor="col-municipality">Municipio</Label>
                  <Input id="col-municipality" placeholder="Ej. Monterrey" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="col-plant">Planta</Label>
                  <Input id="col-plant" placeholder="Ej. Planta Norte" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="col-point">Punto de entrevista</Label>
                  <Input id="col-point" placeholder="Ej. Oficinas centrales" />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </SectionShell>

        {/* --- DatePicker --- */}
        <DatePickerSection />

        {/* --- ErrorPages --- */}
        <SectionShell>
          <SectionHeader
            title="ErrorPages"
            description="Paginas de error para estados 403 (acceso denegado), 404 (no encontrado) y 500 (error del servidor)"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { code: 403, icon: ShieldAlert, title: "Acceso denegado", description: "No tienes permisos para ver esta pagina", colorClass: "text-destructive" },
              { code: 404, icon: SearchX, title: "Pagina no encontrada", description: "La pagina que buscas no existe", colorClass: "text-muted-foreground" },
              { code: 500, icon: ServerCrash, title: "Error del servidor", description: "Algo salio mal, intenta de nuevo", colorClass: "text-destructive" },
            ] as const).map((err) => {
              const Icon = err.icon;
              return (
                <div key={err.code} className="rounded-xl border border-border/40 bg-card p-6 text-center space-y-3">
                  <Icon className={cn("mx-auto h-10 w-10", err.colorClass)} />
                  <p className="font-heading text-lg font-bold">{err.code}</p>
                  <p className="text-sm font-medium">{err.title}</p>
                  <p className="text-xs text-muted-foreground">{err.description}</p>
                </div>
              );
            })}
          </div>
        </SectionShell>

        {/* --- ConfirmDialog --- */}
        <ConfirmDialogSection />

        {/* --- FormLayout + DynamicForm --- */}
        <SectionShell>
          <SectionHeader
            title="FormLayout + DynamicForm"
            description="Formulario dinamico de registro de candidatos controlado por form_config del cliente"
          />
          <DynamicCandidateForm
            formConfig={{
              showInterviewTime: true,
              showPosition: true,
              showMunicipality: false,
              showAge: true,
              showShift: true,
              showPlant: false,
              showInterviewPoint: false,
              showComments: true,
            } satisfies IClientFormConfig}
            clientName="OXXO"
            onSubmit={(data) => {
              toast.success("Formulario enviado (demo)", {
                description: `Datos: ${JSON.stringify(data).slice(0, 80)}...`,
              });
            }}
          />
        </SectionShell>

        {/* --- Footer --- */}
        <footer className="text-center pt-8 pb-4 space-y-3">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="outline">OKLch</Badge>
            <Badge variant="outline">Tailwind v4</Badge>
            <Badge variant="outline">shadcn/ui</Badge>
            <Badge variant="outline">React 19</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Built with BePro Design System v1.0
          </p>
        </footer>
      </main>
    </div>
  );
}
