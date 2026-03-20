"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clientSchema, type ClientFormValues } from "@/lib/schemas/client";
import type { IClientDto } from "@/types/client";

interface ClientFormProps {
  defaultValues?: Partial<IClientDto>;
  onSubmit: (data: ClientFormValues) => void;
  isLoading?: boolean;
}

export default function ClientForm({
  defaultValues,
  onSubmit,
  isLoading,
}: ClientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      contactInfo: defaultValues?.contactInfo ?? "",
      address: defaultValues?.address ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Nombre del cliente *</Label>
        <Input id="name" {...register("name")} placeholder="Ej. Carta Mundi" />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="contactInfo">Información de contacto</Label>
        <Input
          id="contactInfo"
          {...register("contactInfo")}
          placeholder="Teléfono, email, etc."
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="address">Dirección</Label>
        <Textarea
          id="address"
          {...register("address")}
          placeholder="Dirección completa"
          rows={2}
        />
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    </form>
  );
}
