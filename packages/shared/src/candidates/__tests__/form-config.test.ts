import { describe, it, expect } from "vitest";
import { buildDynamicSchema } from "../form-config.js";

describe("buildDynamicSchema (R7 / FR-012)", () => {
  it("returns an empty schema when form_config is missing", () => {
    expect(() => buildDynamicSchema(null).parse({})).not.toThrow();
    expect(() => buildDynamicSchema(undefined).parse({})).not.toThrow();
    expect(() => buildDynamicSchema({ fields: [] }).parse({})).not.toThrow();
  });

  it("validates a representative form_config shape", () => {
    const schema = buildDynamicSchema({
      fields: [
        { key: "desired_salary", label: "Sueldo deseado", type: "number", required: true, min: 1 },
        { key: "shift", label: "Turno", type: "select", required: true, options: ["morning", "evening"] },
        { key: "available_at", label: "Fecha disponible", type: "date", required: false },
        { key: "is_relocating", label: "¿Se mudaría?", type: "checkbox", required: false },
      ],
    });

    expect(
      schema.safeParse({
        desired_salary: 18000,
        shift: "morning",
        available_at: "2026-05-01",
      }).success,
    ).toBe(true);

    // Falla si falta el campo requerido
    expect(
      schema.safeParse({ shift: "morning" }).success,
    ).toBe(false);

    // Falla si select recibe valor fuera del catálogo
    expect(
      schema.safeParse({ desired_salary: 18000, shift: "weekend" }).success,
    ).toBe(false);

    // El campo opcional puede omitirse
    expect(
      schema.safeParse({ desired_salary: 18000, shift: "morning" }).success,
    ).toBe(true);
  });

  it("text fields enforce min/max/regex", () => {
    const schema = buildDynamicSchema({
      fields: [
        {
          key: "curp",
          label: "CURP",
          type: "text",
          required: true,
          pattern: "^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$",
        },
      ],
    });
    expect(schema.safeParse({ curp: "PERJ800101HDFXXX01" }).success).toBe(true);
    expect(schema.safeParse({ curp: "invalido" }).success).toBe(false);
  });
});
