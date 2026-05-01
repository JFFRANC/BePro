import { describe, it, expect } from "vitest";
import {
  createPositionProfileSchema,
  updatePositionProfileSchema,
  positionGenderEnum,
  positionWorkDayEnum,
  positionShiftEnum,
} from "../positions.js";

describe("011 — createPositionProfileSchema", () => {
  it("acepta solo `name` con todos los demás campos omitidos", () => {
    const result = createPositionProfileSchema.safeParse({
      name: "Ayudante General",
    });
    expect(result.success).toBe(true);
  });

  it("acepta el perfil completo con valores enum válidos", () => {
    const result = createPositionProfileSchema.safeParse({
      name: "Ayudante General",
      vacancies: 80,
      ageMin: 18,
      ageMax: 48,
      gender: "indistinto",
      educationLevel: "primaria",
      salaryAmount: 1951.0,
      salaryCurrency: "MXN",
      paymentFrequency: "weekly",
      workDays: ["mon", "tue", "wed", "thu", "fri"],
      shift: "fixed",
      requiredDocuments: ["ACTA DE NACIMIENTO", "CURP", "RFC"],
      faq: ["NO REINGRESOS", "NO MENORES DE EDAD"],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza `ageMin > ageMax`", () => {
    const result = createPositionProfileSchema.safeParse({
      name: "Ayudante General",
      ageMin: 50,
      ageMax: 30,
    });
    expect(result.success).toBe(false);
  });

  it("permite `workDays` vacío (array sin elementos)", () => {
    const result = createPositionProfileSchema.safeParse({
      name: "Soldador",
      workDays: [],
    });
    expect(result.success).toBe(true);
  });

  it("acepta `requiredDocuments` con strings libres (sin enum)", () => {
    const result = createPositionProfileSchema.safeParse({
      name: "Soldador",
      requiredDocuments: ["Cualquier texto", "Otro texto libre"],
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un género inválido", () => {
    const result = createPositionProfileSchema.safeParse({
      name: "Soldador",
      gender: "otro",
    });
    expect(result.success).toBe(false);
  });

  it("acepta `faq` como lista plana de strings (no Q/A pairs)", () => {
    const result = createPositionProfileSchema.safeParse({
      name: "Soldador",
      faq: ["No reingresos", "Edad 18-45"],
    });
    expect(result.success).toBe(true);

    const wrongShape = createPositionProfileSchema.safeParse({
      name: "Soldador",
      faq: [{ question: "?", answer: "!" }],
    });
    expect(wrongShape.success).toBe(false);
  });

  it("rechaza `name` vacío", () => {
    const result = createPositionProfileSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("acepta `salaryCurrency` MXN/USD/EUR únicamente", () => {
    for (const currency of ["MXN", "USD", "EUR"] as const) {
      const result = createPositionProfileSchema.safeParse({
        name: "Soldador",
        salaryCurrency: currency,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rechaza `salaryCurrency` con un código que no es MXN/USD/EUR", () => {
    for (const bogus of ["XYZ", "abc", "MX", "GBP"]) {
      const result = createPositionProfileSchema.safeParse({
        name: "Soldador",
        salaryCurrency: bogus,
      });
      expect(result.success).toBe(false);
    }
  });

  it("expone los enums esperados", () => {
    expect(positionGenderEnum.options).toEqual([
      "masculino",
      "femenino",
      "indistinto",
    ]);
    expect(positionWorkDayEnum.options).toEqual([
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ]);
    expect(positionShiftEnum.options).toEqual(["fixed", "rotating"]);
  });
});

describe("011 — updatePositionProfileSchema", () => {
  it("acepta un objeto vacío (todos los campos son opcionales)", () => {
    const result = updatePositionProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("acepta `null` para limpiar un campo previamente seteado", () => {
    const result = updatePositionProfileSchema.safeParse({
      vacancies: null,
      gender: null,
      faq: null,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza `ageMin > ageMax` también en partial update", () => {
    const result = updatePositionProfileSchema.safeParse({
      ageMin: 60,
      ageMax: 25,
    });
    expect(result.success).toBe(false);
  });
});
