import { validator } from "hono/validator";
import type { z } from "zod";
import type { ValidationTargets } from "hono";

export function zValidator<
  Target extends keyof ValidationTargets,
  Schema extends z.ZodType,
>(target: Target, schema: Schema) {
  return validator(target, (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.issues },
        422,
      );
    }
    return result.data as z.infer<Schema>;
  });
}
