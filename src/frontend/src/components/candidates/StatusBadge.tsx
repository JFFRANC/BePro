import { Badge } from "@/components/ui/badge";
import type { CandidateStatus } from "@/types/candidate";

const STATUS_CONFIG: Record<
  CandidateStatus,
  { label: string; className: string }
> = {
  registered: { label: "Registrado", className: "bg-blue-100 text-blue-800" },
  interview_scheduled: { label: "Cita agendada", className: "bg-blue-100 text-blue-800" },
  attended: { label: "Asistió", className: "bg-yellow-100 text-yellow-800" },
  no_show: { label: "No se presentó", className: "bg-red-100 text-red-800" },
  pending: { label: "Pendiente", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Apto", className: "bg-green-100 text-green-800" },
  rejected: { label: "No apto", className: "bg-red-100 text-red-800" },
  declined: { label: "Declinó", className: "bg-orange-100 text-orange-800" },
  discarded: { label: "Descartado", className: "bg-red-100 text-red-800" },
  hired: { label: "Ingresó", className: "bg-green-100 text-green-800" },
  in_guarantee: { label: "En garantía", className: "bg-purple-100 text-purple-800" },
  guarantee_met: { label: "Garantía cumplida", className: "bg-green-100 text-green-800" },
  guarantee_failed: { label: "Baja", className: "bg-red-100 text-red-800" },
  replacement: { label: "Reposición", className: "bg-orange-100 text-orange-800" },
};

interface StatusBadgeProps {
  status: CandidateStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-gray-100 text-gray-800",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
