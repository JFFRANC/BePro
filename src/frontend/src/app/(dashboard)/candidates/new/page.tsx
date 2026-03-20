"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useClients, useClient } from "@/hooks/useClients";
import { useCreateCandidate } from "@/hooks/useCandidates";
import { candidateSchema, type CandidateFormValues } from "@/lib/schemas/candidate";
import { useState } from "react";

export default function NewCandidatePage() {
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState("");
  const { data: clients } = useClients();
  const { data: clientDetail } = useClient(selectedClientId);
  const createCandidate = useCreateCandidate();

  const config = clientDetail?.formConfig;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: { clientId: "" },
  });

  const onSubmit = async (data: CandidateFormValues) => {
    try {
      const payload = {
        ...data,
        age: data.age ? parseInt(data.age, 10) : undefined,
      };
      const created = await createCandidate.mutateAsync(payload);
      toast.success("Candidato registrado exitosamente");
      router.push(`/candidates/${created.id}`);
    } catch {
      toast.error("Error al registrar candidato");
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Registrar candidato</h1>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Cliente */}
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                {...register("clientId")}
                onChange={(e) => {
                  setValue("clientId", e.target.value, { shouldValidate: true });
                  setSelectedClientId(e.target.value);
                }}
              >
                <option value="">Selecciona un cliente</option>
                {clients?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.clientId && (
                <p className="text-sm text-destructive">{errors.clientId.message}</p>
              )}
            </div>

            {/* Campos obligatorios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nombre completo *</Label>
                <Input {...register("fullName")} placeholder="Nombre del candidato" />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Teléfono *</Label>
                <Input {...register("phone")} placeholder="81 2345 6789" />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label>Fecha de entrevista *</Label>
                <Input type="date" {...register("interviewDate")} />
                {errors.interviewDate && (
                  <p className="text-sm text-destructive">{errors.interviewDate.message}</p>
                )}
              </div>

              {/* Campos opcionales según config del cliente */}
              {config?.showInterviewTime && (
                <div className="space-y-1">
                  <Label>Hora de entrevista</Label>
                  <Input type="time" {...register("interviewTime")} />
                </div>
              )}

              {config?.showPosition && (
                <div className="space-y-1">
                  <Label>Puesto</Label>
                  <Input {...register("position")} placeholder="Ej. Ayudante general" />
                </div>
              )}

              {config?.showMunicipality && (
                <div className="space-y-1">
                  <Label>Municipio</Label>
                  <Input {...register("municipality")} placeholder="Ej. Apodaca" />
                </div>
              )}

              {config?.showAge && (
                <div className="space-y-1">
                  <Label>Edad</Label>
                  <Input type="number" {...register("age")} placeholder="25" min={16} max={99} />
                </div>
              )}

              {config?.showShift && (
                <div className="space-y-1">
                  <Label>Turno</Label>
                  <Input {...register("shift")} placeholder="Ej. Matutino" />
                </div>
              )}

              {config?.showPlant && (
                <div className="space-y-1">
                  <Label>Planta</Label>
                  <Input {...register("plant")} placeholder="Ej. Apodaca" />
                </div>
              )}

              {config?.showInterviewPoint && (
                <div className="space-y-1">
                  <Label>Punto de entrevista</Label>
                  <Input {...register("interviewPoint")} placeholder="Ej. Recursos Humanos" />
                </div>
              )}

              {config?.showComments && (
                <div className="space-y-1 sm:col-span-2">
                  <Label>Comentarios</Label>
                  <Textarea {...register("comments")} placeholder="Notas adicionales..." rows={3} />
                </div>
              )}
            </div>

            <Button type="submit" disabled={createCandidate.isPending} className="w-full sm:w-auto">
              {createCandidate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar candidato
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
