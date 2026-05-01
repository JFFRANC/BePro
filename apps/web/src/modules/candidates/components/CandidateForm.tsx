// 007-candidates-module — formulario de registro de candidato (US1).
// Combina los campos núcleo con los `additional_fields` derivados del
// form_config del cliente seleccionado (R7 / FR-012).
import { useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BASE_CANDIDATE_FIELDS,
  BASE_FIELD_KEY_SET,
  buildDynamicSchema,
  registerCandidateRequestSchema,
  type BaseFieldKey,
  type FormFieldConfig,
} from "@bepro/shared";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";

export interface ClientFormConfigShape {
  fields?: FormFieldConfig[];
  // 008-ux-roles-refinements — the 8 legacy toggles (FR-FC-005). When present
  // and true, each renders as a corresponding additional field (see
  // `legacyTogglesToFields`).
  showAge?: boolean;
  showPlant?: boolean;
  showShift?: boolean;
  showComments?: boolean;
  showPosition?: boolean;
  showMunicipality?: boolean;
  showInterviewTime?: boolean;
  showInterviewPoint?: boolean;
}

// 008-ux-roles-refinements / FR-FC-005 — map the 8 legacy toggles to
// `FormFieldConfig` entries so `CandidateForm` can render + validate them
// alongside the admin-managed `fields[]` from US6. Keeps existing clients
// (e.g. Copreci with `showAge: true, showMunicipality: true, …`) working
// without a data migration.
const LEGACY_TOGGLE_FIELDS: Record<
  keyof Omit<ClientFormConfigShape, "fields">,
  FormFieldConfig
> = {
  showAge: { key: "age", label: "Edad", type: "number", required: false },
  showPlant: { key: "plant", label: "Planta", type: "text", required: false },
  showShift: { key: "shift", label: "Turno", type: "text", required: false },
  showComments: {
    key: "comments",
    label: "Comentarios",
    type: "text",
    required: false,
  },
  showPosition: {
    key: "position",
    label: "Puesto",
    type: "text",
    required: false,
  },
  showMunicipality: {
    key: "municipality",
    label: "Municipio",
    type: "text",
    required: false,
  },
  showInterviewTime: {
    key: "interview_time",
    label: "Hora de entrevista",
    type: "text",
    required: false,
  },
  showInterviewPoint: {
    key: "interview_point",
    label: "Punto de entrevista",
    type: "text",
    required: false,
  },
};

function legacyTogglesToFields(
  config: ClientFormConfigShape | null | undefined,
): FormFieldConfig[] {
  if (!config) return [];
  const out: FormFieldConfig[] = [];
  for (const [toggleKey, fieldDef] of Object.entries(LEGACY_TOGGLE_FIELDS)) {
    if (config[toggleKey as keyof ClientFormConfigShape]) out.push(fieldDef);
  }
  return out;
}

// 012-client-detail-ux / FR-009 — BASE_CANDIDATE_FIELDS go first; admin custom
// + legacy toggles follow. positionId's options are resolved per-call from the
// client's active `client_positions`.
function resolveAllFields(
  config: ClientFormConfigShape | null | undefined,
  positionOptions: { value: string; label: string }[] = [],
): FormFieldConfig[] {
  const baseFields: FormFieldConfig[] = BASE_CANDIDATE_FIELDS.map((b) => {
    if (b.key === "positionId") {
      // Sentinel — empty options array makes buildDynamicSchema treat it as a
      // free string. We render the Select with the resolved client positions
      // in `renderDynamicInput`, looking up the dropdown options from props.
      return {
        key: b.key,
        label: b.label,
        type: "select" as const,
        required: true,
        options: positionOptions.map((p) => p.value),
      };
    }
    return {
      key: b.key,
      label: b.label,
      type: b.type as FormFieldConfig["type"],
      required: true,
    };
  });

  const fromToggles = legacyTogglesToFields(config).filter(
    (f) => !BASE_FIELD_KEY_SET.has(f.key as BaseFieldKey),
  );
  const fromAdmin = (config?.fields ?? [])
    .filter((f) => !("archived" in f) || !(f as FormFieldConfig & { archived?: boolean }).archived)
    .filter((f) => !BASE_FIELD_KEY_SET.has(f.key as BaseFieldKey));

  // Order: BASE → admin → legacy toggles. Dedupe by key (keep first occurrence).
  const merged: FormFieldConfig[] = [];
  const seen = new Set<string>();
  for (const f of [...baseFields, ...fromAdmin, ...fromToggles]) {
    if (!seen.has(f.key)) {
      merged.push(f);
      seen.add(f.key);
    }
  }
  return merged;
}

export interface CandidateFormValues {
  client_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  current_position?: string;
  source: string;
  additional_fields: Record<string, unknown>;
}

// 012-client-detail-ux / FR-009 — opciones del Select positionId.
export interface PositionOption {
  value: string; // client_positions.id
  label: string; // nombre del puesto
}

interface CandidateFormProps {
  clientId: string;
  formConfig: ClientFormConfigShape | null | undefined;
  defaultValues?: Partial<CandidateFormValues>;
  formId?: string;
  onValidSubmit: (values: CandidateFormValues) => void;
  // 012 — opciones del Select positionId; vacío si el cliente no tiene puestos.
  positionOptions?: PositionOption[];
  // 012 / FR-015 — prefills opcionales para los campos base.
  recruiterName?: string;
  accountExecutiveName?: string;
}

function buildFullSchema(
  formConfig: ClientFormConfigShape | null | undefined,
  positionOptions: PositionOption[] = [],
) {
  const allFields = resolveAllFields(formConfig, positionOptions);
  const dynamic = buildDynamicSchema(
    allFields.length > 0 ? { fields: allFields } : null,
  );
  const core = registerCandidateRequestSchema._zod.def.shape;
  return z.object({
    client_id: core.client_id,
    first_name: core.first_name,
    last_name: core.last_name,
    phone: core.phone,
    email: core.email,
    current_position: core.current_position,
    source: core.source,
    additional_fields: dynamic,
  });
}

const CORE_FIELD_LABELS: Record<string, string> = {
  first_name: "Nombre(s)",
  last_name: "Apellidos",
  phone: "Teléfono",
  email: "Correo",
  current_position: "Puesto actual",
  source: "Fuente",
};

export function CandidateForm({
  clientId,
  formConfig,
  defaultValues,
  formId = "candidate-form",
  onValidSubmit,
  positionOptions = [],
  recruiterName,
  accountExecutiveName,
}: CandidateFormProps) {
  const schema = useMemo(
    () => buildFullSchema(formConfig, positionOptions),
    [formConfig, positionOptions],
  );
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  // 012 / FR-015 — prefill recruiterName + accountExecutiveName en additional_fields.
  // Si el caller pasa defaultValues.additional_fields tienen prioridad.
  const baseDefaults = useMemo<Record<string, unknown>>(() => {
    const af: Record<string, unknown> = {};
    if (recruiterName) af.recruiterName = recruiterName;
    if (accountExecutiveName) af.accountExecutiveName = accountExecutiveName;
    return af;
  }, [recruiterName, accountExecutiveName]);

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(schema as never),
    mode: "onBlur", // M7 — valida al perder foco, no en cada tecla.
    reValidateMode: "onChange",
    defaultValues: {
      client_id: clientId,
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
      current_position: "",
      source: "",
      additional_fields: {
        ...baseDefaults,
        ...(defaultValues?.additional_fields ?? {}),
      },
      ...defaultValues,
    },
  });

  useEffect(() => {
    form.setValue("client_id", clientId);
  }, [clientId, form]);

  useEffect(() => {
    // M8: focus en el primer campo al montar (focus-management).
    firstFieldRef.current?.focus();
  }, []);

  // 012 / 008 FR-FC-005 — union of BASE_CANDIDATE_FIELDS + admin custom `fields[]`
  // + legacy toggles. Base goes first.
  const fields = useMemo(
    () => resolveAllFields(formConfig, positionOptions),
    [formConfig, positionOptions],
  );
  const errors = form.formState.errors;
  // Calculamos los entries en cada render — son baratos (≤ ~10 campos) y evitamos
  // useMemo para no crear una clave de dependencia inestable a partir de objetos
  // de error que contienen refs DOM (circular JSON).
  const errorEntries: Array<{
    key: string;
    message: string;
    targetId: string;
  }> = [];
  for (const key of Object.keys(CORE_FIELD_LABELS)) {
    const err = (errors as Record<string, { message?: string } | undefined>)[key];
    if (err?.message) {
      errorEntries.push({ key, message: err.message, targetId: key });
    }
  }
  const additionalErrors = errors.additional_fields as
    | Record<string, { message?: string } | undefined>
    | undefined;
  if (additionalErrors) {
    for (const [k, e] of Object.entries(additionalErrors)) {
      if (e?.message) {
        errorEntries.push({
          key: `additional.${k}`,
          message: `${prettifyKey(k)}: ${e.message}`,
          targetId: `af_${k}`,
        });
      }
    }
  }

  // Registramos first_name aparte para poder enlazarle el ref.
  const firstNameRegister = form.register("first_name");

  return (
    <form
      id={formId}
      onSubmit={form.handleSubmit(onValidSubmit)}
      className="space-y-6"
      noValidate
      aria-describedby={errorEntries.length > 1 ? "form-error-summary" : undefined}
    >
      <input type="hidden" {...form.register("client_id")} />

      {/* M8: error summary cuando hay >1 errores. */}
      {errorEntries.length > 1 && (
        <div
          id="form-error-summary"
          role="alert"
          aria-live="polite"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <p className="font-medium text-destructive flex items-center gap-1.5">
            <AlertCircle className="size-4" aria-hidden="true" />
            Revisa los siguientes campos:
          </p>
          <ul className="mt-2 space-y-1 list-disc list-inside text-destructive/90">
            {errorEntries.map((e) => (
              <li key={e.key}>
                <a
                  href={`#${e.targetId}`}
                  className="underline underline-offset-2"
                  onClick={(ev) => {
                    ev.preventDefault();
                    document.getElementById(e.targetId)?.focus();
                  }}
                >
                  {e.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* M9: fieldset reset (sin border/padding del browser). */}
      <fieldset className="space-y-4 border-0 p-0 m-0">
        <legend className="text-sm font-medium mb-2">Datos básicos</legend>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup
            id="first_name"
            label="Nombre(s)"
            required
            error={errors.first_name?.message as string | undefined}
          >
            <Input
              id="first_name"
              autoComplete="given-name"
              aria-required="true"
              aria-invalid={Boolean(errors.first_name)}
              {...firstNameRegister}
              ref={(e) => {
                firstNameRegister.ref(e);
                firstFieldRef.current = e;
              }}
            />
          </FieldGroup>

          <FieldGroup
            id="last_name"
            label="Apellidos"
            required
            error={errors.last_name?.message as string | undefined}
          >
            <Input
              id="last_name"
              autoComplete="family-name"
              aria-required="true"
              aria-invalid={Boolean(errors.last_name)}
              {...form.register("last_name")}
            />
          </FieldGroup>

          <FieldGroup
            id="phone"
            label="Teléfono"
            required
            helper="Cualquier formato; se compara normalizado para detectar duplicados."
            error={errors.phone?.message as string | undefined}
          >
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+52 55 1234 5678"
              aria-required="true"
              aria-invalid={Boolean(errors.phone)}
              {...form.register("phone")}
            />
          </FieldGroup>

          <FieldGroup
            id="email"
            label="Correo"
            required
            error={errors.email?.message as string | undefined}
          >
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              aria-required="true"
              aria-invalid={Boolean(errors.email)}
              {...form.register("email")}
            />
          </FieldGroup>

          <FieldGroup id="current_position" label="Puesto actual">
            <Input
              id="current_position"
              autoComplete="organization-title"
              {...form.register("current_position")}
            />
          </FieldGroup>

          <FieldGroup
            id="source"
            label="Fuente"
            required
            helper="¿Cómo llegó este candidato? Ej. LinkedIn, referido, OCC."
            error={errors.source?.message as string | undefined}
          >
            <Input
              id="source"
              placeholder="LinkedIn, referido, OCC…"
              aria-required="true"
              aria-invalid={Boolean(errors.source)}
              {...form.register("source")}
            />
          </FieldGroup>
        </div>
      </fieldset>

      {fields.length > 0 ? (
        <fieldset className="space-y-4 border-0 p-0 m-0">
          <legend className="text-sm font-medium mb-2">
            Datos del candidato (campos base + adicionales del cliente)
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((field) => {
              const errPath = errors.additional_fields as
                | Record<string, { message?: string } | undefined>
                | undefined;
              const error = errPath?.[field.key]?.message;
              return (
                <FieldGroup
                  key={field.key}
                  id={`af_${field.key}`}
                  label={field.label}
                  required={field.required}
                  error={error as string | undefined}
                >
                  {renderDynamicInput(
                    field,
                    form,
                    `additional_fields.${field.key}`,
                    field.key === "positionId" ? positionOptions : undefined,
                  )}
                </FieldGroup>
              );
            })}
          </div>
        </fieldset>
      ) : null}
    </form>
  );
}

interface FieldGroupProps {
  id: string;
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
}

function FieldGroup({
  id,
  label,
  required,
  helper,
  error,
  children,
}: FieldGroupProps) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive ml-0.5">
            *
          </span>
        ) : null}
      </Label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p
          role="alert"
          aria-live="polite"
          className="text-xs text-destructive mt-1"
        >
          {error}
        </p>
      ) : helper ? (
        <p className="text-xs text-muted-foreground mt-1">{helper}</p>
      ) : null}
    </div>
  );
}

function renderDynamicInput(
  field: FormFieldConfig,
  form: ReturnType<typeof useForm<CandidateFormValues>>,
  name: string,
  // 012 / FR-009 — para positionId, render con label≠value.
  positionOptions?: PositionOption[],
) {
  const id = `af_${field.key}`;
  switch (field.type) {
    case "text":
      return (
        <Input
          id={id}
          autoComplete="off"
          aria-required={field.required ? "true" : undefined}
          {...form.register(name as never)}
        />
      );
    case "number":
      return (
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          aria-required={field.required ? "true" : undefined}
          {...form.register(name as never)}
        />
      );
    case "date":
      return (
        <Input
          id={id}
          type="date"
          aria-required={field.required ? "true" : undefined}
          {...form.register(name as never)}
        />
      );
    case "select": {
      // 012 — si hay positionOptions explícitas (positionId), label≠value.
      const renderOptions: { value: string; label: string }[] =
        positionOptions && positionOptions.length > 0
          ? positionOptions
          : (field.options ?? []).map((o) => ({ value: o, label: o }));
      return (
        <Controller
          control={form.control}
          name={name as never}
          render={({ field: ctrl }) => (
            <Select
              value={(ctrl.value as string) ?? ""}
              onValueChange={ctrl.onChange}
            >
              <SelectTrigger id={id}>
                <SelectValue placeholder="Selecciona…" />
              </SelectTrigger>
              <SelectContent>
                {renderOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      );
    }
    case "checkbox":
      return (
        <Controller
          control={form.control}
          name={name as never}
          render={({ field: ctrl }) => (
            <Checkbox
              id={id}
              checked={Boolean(ctrl.value)}
              onCheckedChange={(v) => ctrl.onChange(Boolean(v))}
            />
          )}
        />
      );
    default:
      return <Textarea id={id} {...form.register(name as never)} rows={2} />;
  }
}

function prettifyKey(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
