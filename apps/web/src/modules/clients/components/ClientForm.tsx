import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClientSchema } from "@bepro/shared";
import { z } from "zod";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCreateClient, useUpdateClient } from "../hooks/useClients";
import { LocationMap } from "./LocationMap";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import type { IClientDto } from "@bepro/shared";

const clientBasicSchema = createClientSchema.omit({ formConfig: true });
type ClientBasicFormValues = z.infer<typeof clientBasicSchema>;

interface ClientFormProps {
  client?: IClientDto;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient(client?.id ?? "");
  const isEditing = !!client;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ClientBasicFormValues>({
    resolver: zodResolver(clientBasicSchema),
    defaultValues: {
      name: client?.name ?? "",
      address: client?.address ?? "",
      latitude: client?.latitude,
      longitude: client?.longitude,
    },
  });

  const latitude = watch("latitude");
  const longitude = watch("longitude");
  const address = watch("address");

  const onSubmit = async (data: ClientBasicFormValues) => {
    setServerError(null);
    try {
      if (isEditing) {
        await updateClient.mutateAsync(data);
        toast.success("Cliente actualizado exitosamente");
      } else {
        await createClient.mutateAsync(data);
        toast.success("Cliente creado exitosamente");
      }
      onSuccess?.();
    } catch (err) {
      setServerError(
        getApiErrorMessage(err, `Error al ${isEditing ? "actualizar" : "crear"} el cliente`),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name" className="mb-1">
          Nombre de la empresa <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          type="text"
          placeholder="Empresa ABC S.A. de C.V."
          error={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="address" className="mb-1">
          Dirección
        </Label>
        <Input
          id="address"
          type="text"
          placeholder="Av. Reforma 123, Col. Centro, CDMX"
          error={!!errors.address}
          {...register("address")}
        />
        {errors.address && (
          <p className="text-sm text-destructive mt-1">{errors.address.message}</p>
        )}
      </div>

      <div>
        <Label className="mb-1">Ubicación en mapa</Label>
        <LocationMap
          latitude={latitude}
          longitude={longitude}
          address={address}
          onChange={(loc) => {
            setValue("latitude", loc.latitude, { shouldDirty: true });
            setValue("longitude", loc.longitude, { shouldDirty: true });
            if (loc.address) {
              setValue("address", loc.address, { shouldDirty: true });
            }
          }}
        />
      </div>

      {serverError && (
        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Guardando..."
            : isEditing
              ? "Guardar cambios"
              : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
