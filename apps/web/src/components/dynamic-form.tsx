import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { IClientFormConfig } from "@bepro/shared";
import { FormLayout, FormSection, FormField, FormRow } from "@/components/form-layout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  User,
  Phone,
  Calendar,
  Building2,
  Briefcase,
  MapPin,
  UserCheck,
  Clock,
  Sun,
  Factory,
  Navigation,
  MessageSquare,
} from "lucide-react";

interface DynamicCandidateFormProps {
  formConfig: IClientFormConfig;
  clientName: string;
  onSubmit: (data: Record<string, unknown>) => void;
  className?: string;
}

function buildSchema(formConfig: IClientFormConfig) {
  return z.object({
    fullName: z.string().min(1, "El nombre es requerido"),
    phone: z.string().min(1, "El teléfono es requerido"),
    interviewDate: z.string().min(1, "La fecha de entrevista es requerida"),
    ...(formConfig.showInterviewTime && {
      interviewTime: z.string().optional(),
    }),
    ...(formConfig.showPosition && {
      position: z.string().optional(),
    }),
    ...(formConfig.showMunicipality && {
      municipality: z.string().optional(),
    }),
    ...(formConfig.showAge && {
      age: z.string().optional(),
    }),
    ...(formConfig.showShift && {
      shift: z.string().optional(),
    }),
    ...(formConfig.showPlant && {
      plant: z.string().optional(),
    }),
    ...(formConfig.showInterviewPoint && {
      interviewPoint: z.string().optional(),
    }),
    ...(formConfig.showComments && {
      comments: z.string().optional(),
    }),
  });
}

export function DynamicCandidateForm({
  formConfig,
  clientName,
  onSubmit,
  className,
}: DynamicCandidateFormProps) {
  const schema = useMemo(() => buildSchema(formConfig), [formConfig]);

  type FormValues = z.infer<ReturnType<typeof buildSchema>>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  return (
    <FormLayout
      title="Registro de candidato"
      description="Completa los datos del candidato para esta empresa"
      className={className}
    >
      <form onSubmit={handleSubmit((data) => onSubmit(data as Record<string, unknown>))} noValidate>
        <FormSection title="Datos básicos">
          <FormRow>
            <FormField
              label="Nombre completo"
              icon={User}
              htmlFor="fullName"
              error={errors.fullName?.message}
            >
              <Input id="fullName" {...register("fullName")} placeholder="Nombre y apellidos" />
            </FormField>

            <FormField
              label="Teléfono"
              icon={Phone}
              htmlFor="phone"
              error={errors.phone?.message}
            >
              <Input id="phone" {...register("phone")} placeholder="10 dígitos" type="tel" />
            </FormField>
          </FormRow>

          <FormRow>
            <FormField
              label="Fecha de entrevista"
              icon={Calendar}
              htmlFor="interviewDate"
              error={errors.interviewDate?.message}
            >
              <Input id="interviewDate" {...register("interviewDate")} type="date" />
            </FormField>

            {formConfig.showInterviewTime && (
              <FormField
                label="Hora de entrevista"
                icon={Clock}
                htmlFor="interviewTime"
              >
                <Input id="interviewTime" {...register("interviewTime")} type="time" />
              </FormField>
            )}
          </FormRow>

          <FormField
            label="Cliente"
            icon={Building2}
            htmlFor="clientId"
          >
            <Input id="clientId" value={clientName} disabled readOnly />
          </FormField>
        </FormSection>

        {(formConfig.showPosition ||
          formConfig.showMunicipality ||
          formConfig.showAge ||
          formConfig.showShift ||
          formConfig.showPlant ||
          formConfig.showInterviewPoint) && (
          <FormSection title="Datos adicionales">
            <FormRow>
              {formConfig.showPosition && (
                <FormField label="Puesto" icon={Briefcase} htmlFor="position">
                  <Input id="position" {...register("position")} placeholder="Puesto solicitado" />
                </FormField>
              )}

              {formConfig.showAge && (
                <FormField label="Edad" icon={UserCheck} htmlFor="age">
                  <Input id="age" {...register("age")} type="number" placeholder="Años" min={16} max={99} />
                </FormField>
              )}
            </FormRow>

            <FormRow>
              {formConfig.showMunicipality && (
                <FormField label="Municipio" icon={MapPin} htmlFor="municipality">
                  <Input id="municipality" {...register("municipality")} placeholder="Municipio" />
                </FormField>
              )}

              {formConfig.showShift && (
                <FormField label="Turno" icon={Sun} htmlFor="shift">
                  <Input id="shift" {...register("shift")} placeholder="Turno (mañana/tarde/noche)" />
                </FormField>
              )}
            </FormRow>

            <FormRow>
              {formConfig.showPlant && (
                <FormField label="Planta" icon={Factory} htmlFor="plant">
                  <Input id="plant" {...register("plant")} placeholder="Planta o sucursal" />
                </FormField>
              )}

              {formConfig.showInterviewPoint && (
                <FormField label="Punto de entrevista" icon={Navigation} htmlFor="interviewPoint">
                  <Input id="interviewPoint" {...register("interviewPoint")} placeholder="Lugar de entrevista" />
                </FormField>
              )}
            </FormRow>
          </FormSection>
        )}

        {formConfig.showComments && (
          <FormSection title="Notas">
            <FormField label="Observaciones" icon={MessageSquare} htmlFor="comments">
              <Textarea
                id="comments"
                {...register("comments")}
                placeholder="Notas adicionales sobre el candidato..."
                rows={3}
              />
            </FormField>
          </FormSection>
        )}

        <div className="mt-6 flex justify-end">
          <Button type="submit">Registrar candidato</Button>
        </div>
      </form>
    </FormLayout>
  );
}
