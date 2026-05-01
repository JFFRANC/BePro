// 012-client-detail-ux — schema tests for new fields:
//   - clients.description (max 2000, nullable, optional) on updateClientSchema
//   - client_contacts.position (max 120, nullable on update) on
//     createContactSchema / updateContactSchema
import { describe, it, expect } from "vitest";
import {
  updateClientSchema,
  createContactSchema,
  updateContactSchema,
} from "../schemas/client.js";

describe("updateClientSchema — description (012-FR-001)", () => {
  it("accepts a 2000-char description", () => {
    const r = updateClientSchema.safeParse({ description: "x".repeat(2000) });
    expect(r.success).toBe(true);
  });

  it("rejects a 2001-char description with the Spanish message", () => {
    const r = updateClientSchema.safeParse({ description: "x".repeat(2001) });
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues[0]?.message ?? "";
      expect(msg).toMatch(/2,000 caracteres/);
    }
  });

  it("accepts null (clear)", () => {
    const r = updateClientSchema.safeParse({ description: null });
    expect(r.success).toBe(true);
  });

  it("accepts undefined (no change)", () => {
    const r = updateClientSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  it("accepts a multi-line description with markdown markers (plain text)", () => {
    const r = updateClientSchema.safeParse({
      description: "Línea 1\nLínea 2 **bold**",
    });
    expect(r.success).toBe(true);
  });
});

describe("createContactSchema — position (012-FR-002)", () => {
  it("accepts contact without position", () => {
    const r = createContactSchema.safeParse({
      name: "Mariana López",
      phone: "+524422223344",
      email: "mariana@empresa.com",
    });
    expect(r.success).toBe(true);
  });

  it("accepts contact with a 120-char position", () => {
    const r = createContactSchema.safeParse({
      name: "Mariana López",
      phone: "+524422223344",
      email: "mariana@empresa.com",
      position: "y".repeat(120),
    });
    expect(r.success).toBe(true);
  });

  it("rejects position over 120 chars", () => {
    const r = createContactSchema.safeParse({
      name: "Mariana López",
      phone: "+524422223344",
      email: "mariana@empresa.com",
      position: "y".repeat(121),
    });
    expect(r.success).toBe(false);
  });

  it("accepts empty string for position (E-08 — service normalizes to null)", () => {
    const r = createContactSchema.safeParse({
      name: "Mariana López",
      phone: "+524422223344",
      email: "mariana@empresa.com",
      position: "",
    });
    expect(r.success).toBe(true);
  });
});

describe("updateContactSchema — position (012-FR-002)", () => {
  it("accepts position", () => {
    const r = updateContactSchema.safeParse({ position: "Recursos Humanos" });
    expect(r.success).toBe(true);
  });

  it("accepts null to clear", () => {
    const r = updateContactSchema.safeParse({ position: null });
    expect(r.success).toBe(true);
  });

  it("accepts empty string (E-08)", () => {
    const r = updateContactSchema.safeParse({ position: "" });
    expect(r.success).toBe(true);
  });

  it("rejects position over 120 chars", () => {
    const r = updateContactSchema.safeParse({ position: "y".repeat(121) });
    expect(r.success).toBe(false);
  });
});
