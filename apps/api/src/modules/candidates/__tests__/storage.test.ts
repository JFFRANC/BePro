import { describe, it, expect } from "vitest";
import { buildStorageKey, sanitizeFileName } from "../storage.js";

describe("storage — key + sanitize (R4)", () => {
  it("buildStorageKey follows the tenant-prefixed pattern", () => {
    const key = buildStorageKey({
      tenantId: "tenant-uuid",
      candidateId: "cand-uuid",
      attachmentId: "att-uuid",
      fileName: "Mi CV final.pdf",
    });
    expect(key).toBe(
      "tenants/tenant-uuid/candidates/cand-uuid/attachments/att-uuid/Mi_CV_final.pdf",
    );
  });

  it("sanitizeFileName replaces dangerous characters but preserves extension", () => {
    expect(sanitizeFileName("hola/mundo.pdf")).toBe("hola_mundo.pdf");
    expect(sanitizeFileName("documento (final).docx")).toBe(
      "documento_final.docx",
    );

    // Path-traversal input must come out free of separators and ".." sequences.
    const sanitized = sanitizeFileName("../../etc/passwd");
    expect(sanitized).not.toMatch(/[/\\]/);
    expect(sanitized).not.toContain("..");
    expect(sanitized).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("sanitizeFileName preserves the extension when collapsing runs", () => {
    // El nombre inicia con caracteres que se colapsan a un guion bajo líder
    // y debe quedar limpio sin underscore al inicio/fin.
    expect(sanitizeFileName("___hello___.pdf")).toBe("hello.pdf");
  });

  it("sanitizeFileName falls back to 'file' when input has no usable chars", () => {
    expect(sanitizeFileName("///.pdf")).toBe("file.pdf");
  });

  it("sanitizeFileName collapses long names to a safe length", () => {
    const longName = "a".repeat(500) + ".pdf";
    const out = sanitizeFileName(longName);
    expect(out.endsWith(".pdf")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(250);
  });
});
