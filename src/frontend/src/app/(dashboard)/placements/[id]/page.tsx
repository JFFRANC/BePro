"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlacement, useUpdatePlacement } from "@/hooks/usePlacements";
import { useAuthStore } from "@/store/authStore";
import type { PaymentStatus } from "@/types/placement";

export default function PlacementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === "admin" || user?.role === "manager";

  const { data: placement, isLoading } = usePlacement(id);
  const updatePlacement = useUpdatePlacement(id, "");

  const [guaranteeEndDate, setGuaranteeEndDate] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");
  const [paymentDate, setPaymentDate] = useState("");

  const handleUpdate = async (overrides: object) => {
    try {
      await updatePlacement.mutateAsync(overrides as any);
      toast.success("Colocación actualizada");
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("es-MX") : "—";

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!placement)
    return <p className="text-muted-foreground">Colocación no encontrada</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{placement.candidateFullName}</h1>
      </div>

      {/* Info de colocación */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de ingreso</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Fecha ingreso</p>
            <p className="font-medium mt-0.5">{formatDate(placement.hireDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Fin garantía</p>
            <p className="font-medium mt-0.5">{formatDate(placement.guaranteeEndDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Garantía</p>
            <p className="font-medium mt-0.5">
              {placement.guaranteeMet === true
                ? "✅ Cumplida"
                : placement.guaranteeMet === false
                ? "❌ No cumplida"
                : "⏳ Pendiente"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Fecha baja</p>
            <p className="font-medium mt-0.5">{formatDate(placement.terminationDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pago freelancer</p>
            <p className="font-medium mt-0.5">
              {placement.freelancerPaymentStatus === "paid"
                ? "✅ Pagado"
                : placement.freelancerPaymentStatus === "cancelled"
                ? "❌ Cancelado"
                : "⏳ Pendiente"}
            </p>
          </div>
          {placement.freelancerPaymentDate && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Fecha pago</p>
              <p className="font-medium mt-0.5">{formatDate(placement.freelancerPaymentDate)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones admin/manager */}
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actualizar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Garantía */}
            <div className="space-y-2">
              <Label>¿Cumplió garantía?</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={placement.guaranteeMet === true ? "default" : "outline"}
                  onClick={() => handleUpdate({ guaranteeMet: true })}
                  disabled={updatePlacement.isPending}
                >
                  Sí cumplió
                </Button>
                <Button
                  size="sm"
                  variant={placement.guaranteeMet === false ? "destructive" : "outline"}
                  onClick={() => handleUpdate({ guaranteeMet: false })}
                  disabled={updatePlacement.isPending}
                >
                  No cumplió (baja)
                </Button>
              </div>
            </div>

            {/* Fecha fin garantía */}
            <div className="space-y-1">
              <Label>Actualizar fecha fin de garantía</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={guaranteeEndDate}
                  onChange={(e) => setGuaranteeEndDate(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => handleUpdate({ guaranteeEndDate })}
                  disabled={!guaranteeEndDate || updatePlacement.isPending}
                >
                  {updatePlacement.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                </Button>
              </div>
            </div>

            {/* Fecha de baja */}
            <div className="space-y-1">
              <Label>Fecha de baja</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={terminationDate}
                  onChange={(e) => setTerminationDate(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => handleUpdate({ terminationDate })}
                  disabled={!terminationDate || updatePlacement.isPending}
                >
                  Guardar
                </Button>
              </div>
            </div>

            {/* Pago freelancer */}
            <div className="space-y-2">
              <Label>Pago al freelancer</Label>
              <div className="flex gap-2 flex-wrap">
                <select
                  className="border rounded-md px-3 py-2 text-sm bg-background"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                >
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-40"
                />
                <Button
                  size="sm"
                  onClick={() =>
                    handleUpdate({
                      freelancerPaymentStatus: paymentStatus,
                      freelancerPaymentDate: paymentDate || undefined,
                    })
                  }
                  disabled={updatePlacement.isPending}
                >
                  Guardar pago
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
