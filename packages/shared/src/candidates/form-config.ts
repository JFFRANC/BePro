// 007-candidates-module — schema dinámico desde client.form_config (R7 / FR-012)
import { z } from "zod";

export type FormFieldType = "text" | "number" | "date" | "select" | "checkbox";

export interface FormFieldConfig {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: ReadonlyArray<string>; // para type='select'
  min?: number;
  max?: number;
  pattern?: string;
}

export interface ClientFormConfig {
  fields: ReadonlyArray<FormFieldConfig>;
}

// Construye un Zod schema a partir de la configuración del cliente.
// Usado por la API (validación) y por el Web (React Hook Form + zodResolver).
export function buildDynamicSchema(
  formConfig: ClientFormConfig | null | undefined,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  if (!formConfig?.fields?.length) {
    return z.object(shape);
  }

  for (const field of formConfig.fields) {
    let validator: z.ZodTypeAny;

    switch (field.type) {
      case "text": {
        let s = z.string();
        if (field.min !== undefined) s = s.min(field.min);
        if (field.max !== undefined) s = s.max(field.max);
        if (field.pattern) s = s.regex(new RegExp(field.pattern));
        validator = s;
        break;
      }
      case "number": {
        let n = z.coerce.number();
        if (field.min !== undefined) n = n.min(field.min);
        if (field.max !== undefined) n = n.max(field.max);
        validator = n;
        break;
      }
      case "date":
        validator = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Fecha inválida");
        break;
      case "select":
        validator =
          field.options && field.options.length > 0
            ? z.enum(field.options as [string, ...string[]])
            : z.string();
        break;
      case "checkbox":
        validator = z.boolean();
        break;
      default:
        validator = z.unknown();
    }

    if (!field.required) {
      validator = validator.optional();
    }

    shape[field.key] = validator;
  }

  return z.object(shape);
}
