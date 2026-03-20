"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ChevronRight, CheckCircle, XCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlacementsByClient } from "@/hooks/usePlacements";
import { useClients } from "@/hooks/useClients";
import type { IPlacementDto } from "@/types/placement";

function GuaranteeBadge({ placement }: { placement: IPlacementDto }) {
  if (placement.guaranteeMet === true)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-800 bg-green-100 px-2 py-0.5 rounded-full">
        <CheckCircle className="h-3 w-3" /> Cumplida
      </span>
    );
  if (placement.guaranteeMet === false)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
        <XCircle className="h-3 w-3" /> No cumplida
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full">
      <Clock className="h-3 w-3" /> Pendiente
    </span>
  );
}

export default function PlacementsPage() {
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState("");
  const { data: clients } = useClients();
  const { data: placements, isLoading } = usePlacementsByClient(selectedClientId);

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("es-MX") : "—";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Colocaciones</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Candidatos ingresados y seguimiento de garantía
        </p>
      </div>

      <select
        className="border rounded-md px-3 py-2 text-sm bg-background w-full sm:w-64"
        value={selectedClientId}
        onChange={(e) => setSelectedClientId(e.target.value)}
      >
        <option value="">Selecciona un cliente</option>
        {clients?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !selectedClientId ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Selecciona un cliente para ver colocaciones</p>
        </div>
      ) : !placements?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay colocaciones para este cliente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {placements.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`/placements/${p.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{p.candidateFullName}</p>
                    <GuaranteeBadge placement={p} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Ingreso: {formatDate(p.hireDate)}
                    {p.guaranteeEndDate && ` · Garantía: ${formatDate(p.guaranteeEndDate)}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pago freelancer:{" "}
                    {p.freelancerPaymentStatus === "paid"
                      ? "✅ Pagado"
                      : p.freelancerPaymentStatus === "cancelled"
                      ? "❌ Cancelado"
                      : "⏳ Pendiente"}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
