// 008-ux-roles-refinements / US5+US6 — shared schema validation tests.
import { describe, it, expect } from "vitest";
import {
  createFormConfigFieldSchema,
  patchFormConfigFieldSchema,
  formConfigFieldSchema,
} from "../schemas.js";

// batchAssignmentsSchema coverage lives in schemas.batch.test.ts (polymorphic shape).

describe("createFormConfigFieldSchema (US6 / FR-FC-001..006)", () => {
  it("accepts a text field", () => {
    const out = createFormConfigFieldSchema.parse({
      key: "contract_number",
      label: "Número de contrato",
      type: "text",
    });
    expect(out.required).toBe(false);
  });

  it("rejects invalid keys (starts with digit)", () => {
    const r = createFormConfigFieldSchema.safeParse({
      key: "1bad",
      label: "x",
      type: "text",
    });
    expect(r.success).toBe(false);
  });

  it("rejects keys colliding with legacy toggles", () => {
    const r = createFormConfigFieldSchema.safeParse({
      key: "showAge",
      label: "x",
      type: "text",
    });
    expect(r.success).toBe(false);
  });

  it("requires options when type is 'select'", () => {
    const r = createFormConfigFieldSchema.safeParse({
      key: "plant",
      label: "Planta",
      type: "select",
    });
    expect(r.success).toBe(false);
  });

  it("rejects options on non-select types", () => {
    const r = createFormConfigFieldSchema.safeParse({
      key: "age",
      label: "Edad",
      type: "number",
      options: ["a", "b"],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a select field with options", () => {
    const r = createFormConfigFieldSchema.safeParse({
      key: "shift",
      label: "Turno",
      type: "select",
      options: ["día", "noche"],
    });
    expect(r.success).toBe(true);
  });
});

describe("patchFormConfigFieldSchema (US6 / FR-FC-003)", () => {
  it("accepts a label-only patch", () => {
    const r = patchFormConfigFieldSchema.safeParse({ label: "Nueva etiqueta" });
    expect(r.success).toBe(true);
  });

  it("accepts an archived toggle", () => {
    const r = patchFormConfigFieldSchema.safeParse({ archived: true });
    expect(r.success).toBe(true);
  });

  it("rejects attempts to change 'key'", () => {
    const r = patchFormConfigFieldSchema.safeParse({ key: "other" });
    expect(r.success).toBe(false);
  });

  it("rejects attempts to change 'type'", () => {
    const r = patchFormConfigFieldSchema.safeParse({ type: "number" });
    expect(r.success).toBe(false);
  });

  it("rejects empty patches", () => {
    const r = patchFormConfigFieldSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe("formConfigFieldSchema (full stored shape)", () => {
  it("parses a complete stored field", () => {
    const iso = new Date().toISOString();
    const out = formConfigFieldSchema.parse({
      key: "contract_number",
      label: "Número de contrato",
      type: "text",
      required: false,
      options: null,
      archived: false,
      createdAt: iso,
      updatedAt: iso,
    });
    expect(out.key).toBe("contract_number");
  });
});
