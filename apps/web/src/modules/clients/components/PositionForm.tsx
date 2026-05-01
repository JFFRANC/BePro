// 011-puestos-profile-docs / US1 — formulario de perfil completo (acordeón).
//
// Siete secciones:
//   1. Datos generales (name, vacancies, workLocation)
//   2. Perfil (ageMin/Max, gender, civilStatus, educationLevel, experienceText)
//   3. Compensación (salaryAmount, salaryCurrency, paymentFrequency, salaryNotes, benefits)
//   4. Horario (scheduleText, workDays[], shift)
//   5. Documentación requerida (requiredDocuments[] — strings libres)
//   6. Funciones (responsibilities)
//   7. Preguntas frecuentes (faq[] — strings planos, no Q/A pairs)
//
// `name` es el único campo requerido (FR-002). Submit único al final.

import { useEffect, type ReactNode } from "react";
import { useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createPositionProfileSchema,
  type CreatePositionProfileInput,
  type IClientPositionDto,
} from "@bepro/shared";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  X,
  Loader2,
  IdCard,
  User,
  BadgeDollarSign,
  Clock,
  ListChecks,
  ClipboardList,
  MessageCircleQuestion,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Control } from "react-hook-form";
import { motion, AnimatePresence, useAutoAnimate } from "@/components/motion";

// Sentinel para representar "sin selección" en base-ui Select. base-ui acepta
// `null` como value, pero los `<SelectItem>` no aceptan `value={null}` (lo
// tratan como item sin valor), así que conservamos un sentinel string que
// se traduce a `null` en el callback `onChange`.
const NULL_SELECT = "__null__";

// Acordeón: array hoisted a constante de módulo. Antes vivía inline en el JSX
// y se recreaba en cada render, lo que provocaba que base-ui reinicialice el
// estado uncontrolled del acordeón cada vez que el padre re-renderizaba.
const ACCORDION_DEFAULT_OPEN = ["general", "perfil"];

interface NullableSelectOption {
  value: string;
  label: string;
}

// `NullableSelect` extraído al top-level — antes vivía dentro del cuerpo de
// `PositionForm` y se redefinía en cada render, costando identidad de
// componente y, potencialmente, focus/keyboard state.
//
// Usa `children` como función render para que `Select.Value` mapee el valor
// crudo (incluyendo el sentinel `__null__`) al label legible. Sin esto,
// base-ui pinta el value crudo en el trigger — el bug que reportaba el
// usuario donde se veía literalmente "__null__".
function NullableSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  options: NullableSelectOption[];
  placeholder: string;
}) {
  return (
    <Select
      value={value ?? NULL_SELECT}
      onValueChange={(v) => onChange(v === NULL_SELECT ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {(v) => {
            if (v == null || v === NULL_SELECT) return placeholder;
            return (
              options.find((o) => o.value === v)?.label ?? placeholder
            );
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NULL_SELECT}>Sin especificar</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Contador de caracteres para textareas grandes. Usa `useWatch` para no causar
// re-renders del form completo en cada keystroke. Cambia a color warning
// cuando el usuario está cerca del límite (≥90%) para señalar el cierre del
// espacio sin bloquear la escritura.
function CharCount({
  control,
  name,
  max,
}: {
  control: Control<CreatePositionProfileInput>;
  name: keyof CreatePositionProfileInput;
  max: number;
}) {
  const value = useWatch({ control, name });
  const len = typeof value === "string" ? value.length : 0;
  const ratio = len / max;
  const colorClass =
    ratio >= 1
      ? "text-destructive font-medium"
      : ratio >= 0.9
        ? "text-warning font-medium"
        : "text-muted-foreground";
  return (
    <p
      className={cn(
        "text-xs text-right tabular-nums mt-1 transition-colors duration-200",
        colorClass,
      )}
    >
      {len}/{max}
    </p>
  );
}

// Badge "completo" — chip pequeño con check al lado del título de sección.
// Se monta/desmonta con un spring-pop que confirma "esta sección ya tiene
// datos". Causal animation (state change → micro-feedback), no decorativo.
function CompletionBadge() {
  return (
    <motion.span
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      className="inline-flex"
    >
      <Badge
        data-slot="completion-badge"
        variant="secondary"
        className="ml-2 h-5 px-1.5 text-[10px]"
        aria-label="Sección con datos"
      >
        <Check className="h-3 w-3" />
      </Badge>
    </motion.span>
  );
}

// Trigger de sección con ícono + título + badge condicional. AnimatePresence
// permite que el badge anime su salida cuando la sección queda vacía
// (e.g. el usuario borró el último campo).
function SectionTrigger({
  icon: Icon,
  title,
  complete,
}: {
  icon: typeof IdCard;
  title: string;
  complete: boolean;
}) {
  return (
    <AccordionTrigger>
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span>{title}</span>
        <AnimatePresence>
          {complete ? <CompletionBadge /> : null}
        </AnimatePresence>
      </span>
    </AccordionTrigger>
  );
}

// Helper: ¿hay al menos un valor "non-empty"? Tratamos "", null, undefined,
// y arrays vacíos como vacío.
function isNonEmpty(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return true;
  return Boolean(v);
}

const GENDER_OPTIONS = [
  { value: "masculino", label: "Masculino" },
  { value: "femenino", label: "Femenino" },
  { value: "indistinto", label: "Indistinto" },
];

const CIVIL_STATUS_OPTIONS = [
  { value: "soltero", label: "Soltero" },
  { value: "casado", label: "Casado" },
  { value: "indistinto", label: "Indistinto" },
];

const EDUCATION_LEVEL_OPTIONS = [
  { value: "ninguna", label: "Ninguna" },
  { value: "primaria", label: "Primaria" },
  { value: "secundaria", label: "Secundaria" },
  { value: "preparatoria", label: "Preparatoria" },
  { value: "tecnica", label: "Técnica" },
  { value: "licenciatura", label: "Licenciatura" },
  { value: "posgrado", label: "Posgrado" },
];

const PAYMENT_FREQ_OPTIONS = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
];

const CURRENCY_OPTIONS = [
  { value: "MXN", label: "MXN" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

const SHIFT_OPTIONS = [
  { value: "fixed", label: "Fijo" },
  { value: "rotating", label: "Rotativo" },
];

// Stagger del page-load: cada AccordionItem entra 40ms después del anterior.
// Usamos clases de tw-animate-css (`animate-in fade-in slide-in-from-bottom-3`)
// porque viven en CSS puro — funcionan con SSR, no requieren JS bootstrap, y
// honran `motion-reduce` automáticamente.
//
// Orden visual ≠ orden de array; mantengo ambos sincronizados a través del
// índice del bucle en el JSX (general → perfil → compensacion → horario →
// docs → funciones → faq).
const STAGGER_BASE_MS = 40;
const ACCORDION_ITEM_ANIMATION =
  "animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both duration-500 ease-out motion-reduce:animate-none";

const WORK_DAY_OPTIONS = [
  { value: "mon", label: "Lun" },
  { value: "tue", label: "Mar" },
  { value: "wed", label: "Mié" },
  { value: "thu", label: "Jue" },
  { value: "fri", label: "Vie" },
  { value: "sat", label: "Sáb" },
  { value: "sun", label: "Dom" },
] as const;

interface PositionFormProps {
  defaultValues?: Partial<IClientPositionDto>;
  onSubmit: (values: CreatePositionProfileInput) => Promise<void> | void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

function valuesFromPosition(
  pos?: Partial<IClientPositionDto>,
): CreatePositionProfileInput {
  return {
    name: pos?.name ?? "",
    vacancies: pos?.vacancies ?? null,
    workLocation: pos?.workLocation ?? null,
    ageMin: pos?.ageMin ?? null,
    ageMax: pos?.ageMax ?? null,
    gender: pos?.gender ?? null,
    civilStatus: pos?.civilStatus ?? null,
    educationLevel: pos?.educationLevel ?? null,
    experienceText: pos?.experienceText ?? null,
    salaryAmount: pos?.salaryAmount ?? null,
    salaryCurrency: pos?.salaryCurrency ?? "MXN",
    paymentFrequency: pos?.paymentFrequency ?? null,
    salaryNotes: pos?.salaryNotes ?? null,
    benefits: pos?.benefits ?? null,
    scheduleText: pos?.scheduleText ?? null,
    workDays: pos?.workDays ?? null,
    shift: pos?.shift ?? null,
    requiredDocuments: pos?.requiredDocuments ?? null,
    responsibilities: pos?.responsibilities ?? null,
    faq: pos?.faq ?? null,
  };
}

export function PositionForm({
  defaultValues,
  onSubmit,
  submitLabel = "Guardar cambios",
  isSubmitting = false,
}: PositionFormProps) {
  const form = useForm<CreatePositionProfileInput>({
    resolver: zodResolver(createPositionProfileSchema),
    defaultValues: valuesFromPosition(defaultValues),
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = form;

  // Re-sincronizar cuando cambia la posición (e.g. otra carga remota).
  useEffect(() => {
    reset(valuesFromPosition(defaultValues));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues?.id]);

  // Completitud por sección — usadas para el badge "Check" en el trigger.
  // P2.L: el badge aparece cuando una sección tiene al menos un campo del
  // perfil rellenado.
  const watchAll = useWatch({ control });
  const sectionComplete = {
    general:
      isNonEmpty(watchAll?.name) ||
      isNonEmpty(watchAll?.vacancies) ||
      isNonEmpty(watchAll?.workLocation),
    perfil:
      isNonEmpty(watchAll?.ageMin) ||
      isNonEmpty(watchAll?.ageMax) ||
      isNonEmpty(watchAll?.gender) ||
      isNonEmpty(watchAll?.civilStatus) ||
      isNonEmpty(watchAll?.educationLevel) ||
      isNonEmpty(watchAll?.experienceText),
    compensacion:
      isNonEmpty(watchAll?.salaryAmount) ||
      isNonEmpty(watchAll?.paymentFrequency) ||
      isNonEmpty(watchAll?.salaryNotes) ||
      isNonEmpty(watchAll?.benefits),
    horario:
      isNonEmpty(watchAll?.scheduleText) ||
      isNonEmpty(watchAll?.workDays) ||
      isNonEmpty(watchAll?.shift),
    docs: isNonEmpty(watchAll?.requiredDocuments),
    funciones: isNonEmpty(watchAll?.responsibilities),
    faq: isNonEmpty(watchAll?.faq),
  };

  const requiredDocsArr = useFieldArray({
    control,
    // @ts-expect-error react-hook-form quiere objetos; aceptamos string[]
    name: "requiredDocuments",
  });
  const faqArr = useFieldArray({
    control,
    // @ts-expect-error react-hook-form quiere objetos; aceptamos string[]
    name: "faq",
  });

  // AutoAnimate: cuando el usuario agrega o quita un item de las listas
  // dinámicas, los elementos vecinos se reorganizan con un slide natural en
  // lugar de "saltar". El listener honra `prefers-reduced-motion` por
  // defecto. `duration` se mantiene corto para no entorpecer.
  const [docsListRef] = useAutoAnimate({ duration: 200, easing: "ease-out" });
  const [faqListRef] = useAutoAnimate({ duration: 200, easing: "ease-out" });

  const workDaysWatch = watch("workDays") ?? [];
  const toggleWorkDay = (day: (typeof WORK_DAY_OPTIONS)[number]["value"]) => {
    const current = new Set(workDaysWatch ?? []);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    setValue(
      "workDays",
      Array.from(current) as CreatePositionProfileInput["workDays"],
      { shouldDirty: true },
    );
  };

  const submit = handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <Accordion
        // base-ui Accordion: `multiple` permite varias secciones abiertas.
        // `defaultValue` apunta a una constante de módulo (referencia estable)
        // para que el estado uncontrolled no se reinicialice en re-renders.
        multiple
        defaultValue={ACCORDION_DEFAULT_OPEN}
        className="space-y-2"
      >
        {/* 1. Datos generales */}
        <AccordionItem
          value="general"
          className={cn("border rounded-lg px-4", ACCORDION_ITEM_ANIMATION)}
          style={{ animationDelay: `${0 * STAGGER_BASE_MS}ms` }}
        >
          <SectionTrigger
            icon={IdCard}
            title="Datos generales"
            complete={sectionComplete.general}
          />
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label htmlFor="name">
                Nombre del puesto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                {...register("name")}
                aria-invalid={!!errors.name}
                placeholder="AYUDANTE GENERAL"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vacancies">Vacantes</Label>
                <Input
                  id="vacancies"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  {...register("vacancies", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
                />
              </div>
              <div>
                <Label htmlFor="workLocation">Lugar de trabajo</Label>
                <Input id="workLocation" {...register("workLocation")} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Perfil */}
        <AccordionItem
          value="perfil"
          className={cn("border rounded-lg px-4", ACCORDION_ITEM_ANIMATION)}
          style={{ animationDelay: `${1 * STAGGER_BASE_MS}ms` }}
        >
          <SectionTrigger
            icon={User}
            title="Perfil"
            complete={sectionComplete.perfil}
          />
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ageMin">Edad mínima</Label>
                  <Input
                    id="ageMin"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    aria-invalid={!!errors.ageMin}
                    {...register("ageMin", {
                      setValueAs: (v) =>
                        v === "" || v == null ? null : Number(v),
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="ageMax">Edad máxima</Label>
                  <Input
                    id="ageMax"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={120}
                    aria-invalid={!!errors.ageMin}
                    {...register("ageMax", {
                      setValueAs: (v) =>
                        v === "" || v == null ? null : Number(v),
                    })}
                  />
                </div>
              </div>
              {/* El refine de Zod engancha el error en `ageMin`. Lo mostramos
                  como un único nodo `role=alert` debajo del par para que sea
                  obvio a qué se refiere. */}
              {errors.ageMin && (
                <p
                  role="alert"
                  className="text-sm text-destructive mt-1"
                >
                  {errors.ageMin.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label>Género</Label>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <NullableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={GENDER_OPTIONS}
                      placeholder="Sin especificar"
                    />
                  )}
                />
              </div>
              <div>
                <Label>Estado civil</Label>
                <Controller
                  control={control}
                  name="civilStatus"
                  render={({ field }) => (
                    <NullableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={CIVIL_STATUS_OPTIONS}
                      placeholder="Sin especificar"
                    />
                  )}
                />
              </div>
              <div>
                <Label>Escolaridad</Label>
                <Controller
                  control={control}
                  name="educationLevel"
                  render={({ field }) => (
                    <NullableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={EDUCATION_LEVEL_OPTIONS}
                      placeholder="Sin especificar"
                    />
                  )}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="experienceText">Experiencia requerida</Label>
              <Textarea
                id="experienceText"
                rows={3}
                maxLength={2000}
                {...register("experienceText")}
              />
              <CharCount control={control} name="experienceText" max={2000} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Compensación */}
        <AccordionItem
          value="compensacion"
          className={cn("border rounded-lg px-4", ACCORDION_ITEM_ANIMATION)}
          style={{ animationDelay: `${2 * STAGGER_BASE_MS}ms` }}
        >
          <SectionTrigger
            icon={BadgeDollarSign}
            title="Compensación"
            complete={sectionComplete.compensacion}
          />
          <AccordionContent className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="salaryAmount">Salario base</Label>
                <Input
                  id="salaryAmount"
                  type="number"
                  inputMode="numeric"
                  step="0.01"
                  min={0}
                  {...register("salaryAmount", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
                />
              </div>
              <div>
                <Label>Moneda</Label>
                <Controller
                  control={control}
                  name="salaryCurrency"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "MXN"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="MXN">
                          {(v) => (v == null ? "MXN" : String(v))}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label>Frecuencia de pago</Label>
                <Controller
                  control={control}
                  name="paymentFrequency"
                  render={({ field }) => (
                    <NullableSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={PAYMENT_FREQ_OPTIONS}
                      placeholder="Sin especificar"
                    />
                  )}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="salaryNotes">Notas de compensación</Label>
              <Textarea
                id="salaryNotes"
                rows={3}
                maxLength={2000}
                {...register("salaryNotes")}
                placeholder="Vales, bonos, etc."
              />
              <CharCount control={control} name="salaryNotes" max={2000} />
            </div>
            <div>
              <Label htmlFor="benefits">Prestaciones</Label>
              <Textarea
                id="benefits"
                rows={3}
                maxLength={4000}
                {...register("benefits")}
              />
              <CharCount control={control} name="benefits" max={4000} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 4. Horario */}
        <AccordionItem
          value="horario"
          className={cn("border rounded-lg px-4", ACCORDION_ITEM_ANIMATION)}
          style={{ animationDelay: `${3 * STAGGER_BASE_MS}ms` }}
        >
          <SectionTrigger
            icon={Clock}
            title="Horario"
            complete={sectionComplete.horario}
          />
          <AccordionContent className="space-y-4 pt-2">
            <div>
              <Label htmlFor="scheduleText">Descripción del horario</Label>
              <Textarea
                id="scheduleText"
                rows={3}
                maxLength={2000}
                {...register("scheduleText")}
              />
              <CharCount control={control} name="scheduleText" max={2000} />
            </div>
            <div>
              <Label>Días de trabajo</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {WORK_DAY_OPTIONS.map((d) => {
                  const checked = (workDaysWatch ?? []).includes(d.value);
                  return (
                    <label
                      key={d.value}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1 border rounded-md cursor-pointer transition-colors",
                        checked
                          ? "bg-primary/10 border-primary text-primary"
                          : "hover:bg-accent",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleWorkDay(d.value)}
                      />
                      <span className="text-sm">{d.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Turno</Label>
              <Controller
                control={control}
                name="shift"
                render={({ field }) => (
                  <NullableSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={SHIFT_OPTIONS}
                    placeholder="Sin especificar"
                  />
                )}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 5. Documentación requerida */}
        <AccordionItem
          value="docs"
          className={cn("border rounded-lg px-4", ACCORDION_ITEM_ANIMATION)}
          style={{ animationDelay: `${4 * STAGGER_BASE_MS}ms` }}
        >
          <SectionTrigger
            icon={ListChecks}
            title="Documentación requerida"
            complete={sectionComplete.docs}
          />
          <AccordionContent className="space-y-2 pt-2">
            {requiredDocsArr.fields.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin documentación requerida.
              </p>
            )}
            <div
              ref={docsListRef}
              data-slot="auto-animate-list"
              className="space-y-2"
            >
              {requiredDocsArr.fields.map((f, idx) => (
                <div key={f.id} className="flex gap-2">
                  <Input
                    {...register(`requiredDocuments.${idx}` as const)}
                    placeholder="ACTA DE NACIMIENTO"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => requiredDocsArr.remove(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => requiredDocsArr.append("" as unknown as never)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar documento
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* 6. Funciones */}
        <AccordionItem
          value="funciones"
          className={cn("border rounded-lg px-4", ACCORDION_ITEM_ANIMATION)}
          style={{ animationDelay: `${5 * STAGGER_BASE_MS}ms` }}
        >
          <SectionTrigger
            icon={ClipboardList}
            title="Funciones"
            complete={sectionComplete.funciones}
          />
          <AccordionContent className="space-y-2 pt-2">
            <div>
              <Label htmlFor="responsibilities">Funciones del puesto</Label>
              <Textarea
                id="responsibilities"
                rows={5}
                maxLength={4000}
                {...register("responsibilities")}
              />
              <CharCount
                control={control}
                name="responsibilities"
                max={4000}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 7. FAQ */}
        <AccordionItem
          value="faq"
          className={cn("border rounded-lg px-4", ACCORDION_ITEM_ANIMATION)}
          style={{ animationDelay: `${6 * STAGGER_BASE_MS}ms` }}
        >
          <SectionTrigger
            icon={MessageCircleQuestion}
            title="Preguntas frecuentes"
            complete={sectionComplete.faq}
          />
          <AccordionContent className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground">
              Lista de filtros / observaciones (no es Q/A).
            </p>
            {faqArr.fields.length === 0 && (
              <p className="text-sm text-muted-foreground italic">
                Sin filtros agregados.
              </p>
            )}
            <div
              ref={faqListRef}
              data-slot="auto-animate-list"
              className="space-y-2"
            >
              {faqArr.fields.map((f, idx) => (
                <div key={f.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums w-7 shrink-0">
                    {idx + 1}.-
                  </span>
                  <Input
                    {...register(`faq.${idx}` as const)}
                    placeholder={
                      idx === 0
                        ? "NO REINGRESOS"
                        : idx === 1
                          ? "NO MENORES DE EDAD"
                          : "Escribe un filtro"
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => faqArr.remove(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => faqArr.append("" as unknown as never)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* P2.M: en mobile el submit queda pegado al borde inferior con backdrop
          blur para no perder el botón al hacer scroll dentro del form largo. */}
      {/* P2.M: en mobile el submit queda pegado al borde inferior con backdrop
          blur para no perder el botón al hacer scroll dentro del form largo.
          Motion #5: micro-scale on hover (motion-reduce safe). */}
      <div className="flex justify-end sticky bottom-0 -mx-4 px-4 py-3 bg-background/80 backdrop-blur-sm border-t sm:static sm:mx-0 sm:px-0 sm:py-0 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            "transition-[transform,box-shadow] duration-200 ease-out",
            "hover:not-disabled:scale-[1.02] hover:not-disabled:shadow-md",
            "active:not-disabled:scale-[0.98]",
            "motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100",
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2
                className="h-4 w-4 mr-2 animate-spin"
                aria-hidden="true"
              />
              <span>Guardando…</span>
            </>
          ) : (
            <span>{submitLabel}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
