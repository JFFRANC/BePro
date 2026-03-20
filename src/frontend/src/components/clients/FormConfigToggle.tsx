"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useUpdateClient } from "@/hooks/useClients";
import type { IClientDto, IClientFormConfig } from "@/types/client";

const CONFIG_LABELS: Record<keyof IClientFormConfig, string> = {
  showInterviewTime: "Hora de entrevista",
  showPosition: "Puesto",
  showMunicipality: "Municipio",
  showAge: "Edad",
  showShift: "Turno",
  showPlant: "Planta",
  showInterviewPoint: "Punto de entrevista",
  showComments: "Comentarios",
};

interface FormConfigToggleProps {
  client: IClientDto;
  readOnly?: boolean;
}

export default function FormConfigToggle({
  client,
  readOnly,
}: FormConfigToggleProps) {
  const [config, setConfig] = useState<IClientFormConfig>(client.formConfig);
  const updateClient = useUpdateClient(client.id);

  const handleToggle = async (key: keyof IClientFormConfig) => {
    if (readOnly) return;
    const newConfig = { ...config, [key]: !config[key] };
    setConfig(newConfig);
    try {
      await updateClient.mutateAsync({ formConfig: newConfig });
      toast.success("Configuración actualizada");
    } catch {
      setConfig(config);
      toast.error("Error al actualizar configuración");
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Selecciona los campos que aparecerán en el formulario de registro de
        candidatos para este cliente.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.keys(CONFIG_LABELS) as Array<keyof IClientFormConfig>).map(
          (key) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <Label htmlFor={key} className="cursor-pointer">
                {CONFIG_LABELS[key]}
              </Label>
              <button
                id={key}
                role="switch"
                aria-checked={config[key]}
                onClick={() => handleToggle(key)}
                disabled={readOnly || updateClient.isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                  config[key] ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    config[key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )
        )}
      </div>
      {updateClient.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Guardando...
        </div>
      )}
    </div>
  );
}
