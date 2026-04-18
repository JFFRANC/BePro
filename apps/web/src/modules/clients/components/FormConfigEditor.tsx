import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUpdateClient } from "../hooks/useClients";
import { getApiErrorMessage } from "@/lib/error-utils";
import { toast } from "sonner";
import type { IClientFormConfig, IClientDto } from "@bepro/shared";

const FIELD_LABELS: Record<keyof IClientFormConfig, string> = {
  showInterviewTime: "Hora de entrevista",
  showPosition: "Puesto",
  showMunicipality: "Municipio",
  showAge: "Edad",
  showShift: "Turno",
  showPlant: "Planta",
  showInterviewPoint: "Punto de entrevista",
  showComments: "Comentarios",
};

interface FormConfigEditorProps {
  client: IClientDto;
  readOnly?: boolean;
}

export function FormConfigEditor({ client, readOnly = false }: FormConfigEditorProps) {
  const [config, setConfig] = useState<IClientFormConfig>({ ...client.formConfig });
  const [isDirty, setIsDirty] = useState(false);
  const updateClient = useUpdateClient(client.id);

  const handleToggle = (field: keyof IClientFormConfig, checked: boolean) => {
    setConfig((prev) => ({ ...prev, [field]: checked }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateClient.mutateAsync({ formConfig: config });
      setIsDirty(false);
      toast.success("Configuración de formulario guardada");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Error al guardar la configuración"));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecciona los campos adicionales que se mostrarán en el formulario de registro de candidatos para este cliente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(FIELD_LABELS) as (keyof IClientFormConfig)[]).map((field) => (
          <div key={field} className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor={field} className="cursor-pointer">
              {FIELD_LABELS[field]}
            </Label>
            <Switch
              id={field}
              checked={config[field]}
              onCheckedChange={(checked) => handleToggle(field, checked)}
              disabled={readOnly}
            />
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!isDirty || updateClient.isPending}>
            {updateClient.isPending ? "Guardando..." : "Guardar configuración"}
          </Button>
        </div>
      )}
    </div>
  );
}
