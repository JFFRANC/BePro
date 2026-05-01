import { describe, it, expect } from "vitest";
import { positionAuditPayloadSchema } from "../audit.js";

describe("011 — positionAuditPayloadSchema", () => {
  it("valida el payload de client_position.create", () => {
    const result = positionAuditPayloadSchema.safeParse({
      kind: "client_position.create",
      old: null,
      new: {
        clientId: "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6111",
        name: "AYUDANTE GENERAL",
        vacancies: 80,
        ageMin: 18,
        ageMax: 48,
        gender: "indistinto",
        educationLevel: "primaria",
        salaryAmount: "1951.00",
        salaryCurrency: "MXN",
        paymentFrequency: "weekly",
        workDays: ["mon", "tue", "wed", "thu", "fri"],
        shift: "fixed",
        requiredDocuments: ["CURP"],
        faq: ["NO REINGRESOS"],
      },
    });
    expect(result.success).toBe(true);
  });

  it("valida client_position.update con diff parcial", () => {
    const result = positionAuditPayloadSchema.safeParse({
      kind: "client_position.update",
      old: { salaryAmount: "1951.00", salaryNotes: "..." },
      new: { salaryAmount: "2050.00", salaryNotes: "+ vales" },
    });
    expect(result.success).toBe(true);
  });

  it("valida position_document.create", () => {
    const result = positionAuditPayloadSchema.safeParse({
      kind: "position_document.create",
      old: null,
      new: {
        positionId: "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6222",
        type: "contract",
        originalName: "contrato.pdf",
        mimeType: "application/pdf",
        sizeBytes: 412380,
        uploadedBy: "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6333",
      },
    });
    expect(result.success).toBe(true);
  });

  it("valida position_document.replace con priorDocumentId", () => {
    const result = positionAuditPayloadSchema.safeParse({
      kind: "position_document.replace",
      old: {
        priorDocumentId: "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6444",
        priorReplacedAt: "2026-04-30T14:22:01.123Z",
        priorOriginalName: "v1.pdf",
        priorSizeBytes: 401020,
      },
      new: {
        positionId: "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6222",
        type: "contract",
        originalName: "v2.pdf",
        mimeType: "application/pdf",
        sizeBytes: 412380,
        uploadedBy: "3a1f6ad2-1e8a-4cb9-9b1f-5f2c2c0b6333",
      },
    });
    expect(result.success).toBe(true);
  });

  it("valida client_document.archive", () => {
    const result = positionAuditPayloadSchema.safeParse({
      kind: "client_document.archive",
      old: null,
      new: {
        rowsAffected: 142,
        migrationId: "0010_legacy_client_documents_archive",
        reason: "feature-011-rollout",
        executedAt: "2026-05-15T03:14:22.000Z",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rechaza una combinación kind/payload inválida", () => {
    const result = positionAuditPayloadSchema.safeParse({
      kind: "position_document.create",
      old: null,
      new: { positionId: "not-a-uuid" },
    });
    expect(result.success).toBe(false);
  });
});
