import { describe, it, expect } from "vitest";
import {
  createPositionDocumentSchema,
  POSITION_DOCUMENT_ALLOWED_MIME_TYPES,
  MAX_POSITION_DOCUMENT_BYTES,
} from "../positions.js";

describe("011 — createPositionDocumentSchema", () => {
  it("acepta type=contract con PDF dentro del límite", () => {
    const result = createPositionDocumentSchema.safeParse({
      type: "contract",
      originalName: "contrato.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it("acepta type=pase_visita con DOCX", () => {
    const result = createPositionDocumentSchema.safeParse({
      type: "pase_visita",
      originalName: "pase.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 50_000,
    });
    expect(result.success).toBe(true);
  });

  it("rechaza un type fuera del enum", () => {
    const result = createPositionDocumentSchema.safeParse({
      type: "anexo_3",
      originalName: "x.pdf",
      mimeType: "application/pdf",
      sizeBytes: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza un MIME no permitido", () => {
    const result = createPositionDocumentSchema.safeParse({
      type: "contract",
      originalName: "x.txt",
      mimeType: "text/plain",
      sizeBytes: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza tamaño superior a 10 MiB (FR-013)", () => {
    const result = createPositionDocumentSchema.safeParse({
      type: "contract",
      originalName: "huge.pdf",
      mimeType: "application/pdf",
      sizeBytes: MAX_POSITION_DOCUMENT_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it("expone exactamente los MIME types permitidos por FR-013", () => {
    expect(POSITION_DOCUMENT_ALLOWED_MIME_TYPES).toEqual([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
  });
});
