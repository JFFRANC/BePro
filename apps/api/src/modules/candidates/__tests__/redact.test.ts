import { describe, it, expect } from "vitest";
import { redactCandidate, redactObject, PII_KEYS_DEFAULT } from "../redact.js";

describe("redactCandidate", () => {
  const sample = {
    id: "11111111-1111-1111-1111-111111111111",
    tenant_id: "22222222-2222-2222-2222-222222222222",
    client_id: "33333333-3333-3333-3333-333333333333",
    registering_user_id: "44444444-4444-4444-4444-444444444444",
    first_name: "Juan",
    last_name: "Pérez",
    phone: "+52 55 1234 5678",
    phone_normalized: "5512345678",
    email: "juan.perez@example.com",
    current_position: "Operario",
    source: "LinkedIn",
    status: "registered" as const,
    is_active: true,
    additional_fields: {
      curp: "PERJ800101HDFXXX01",
      rfc: "PEPJ800101XXX",
      second_phone: "5587654321",
      desired_salary: 18000,
    },
  };

  it("removes core PII fields and keeps safe identifiers", () => {
    const safe = redactCandidate(sample);
    expect(safe).not.toHaveProperty("first_name");
    expect(safe).not.toHaveProperty("last_name");
    expect(safe).not.toHaveProperty("phone");
    expect(safe).not.toHaveProperty("phone_normalized");
    expect(safe).not.toHaveProperty("email");

    expect(safe.id).toBe(sample.id);
    expect(safe.tenant_id).toBe(sample.tenant_id);
    expect(safe.client_id).toBe(sample.client_id);
    expect(safe.status).toBe("registered");
    expect(safe.is_active).toBe(true);
    expect(safe.registering_user_id).toBe(sample.registering_user_id);
  });

  it("redacts CURP/RFC/second_phone inside additional_fields (FR-011a)", () => {
    const safe = redactCandidate(sample);
    expect(safe.additional_fields).toBeDefined();
    expect(safe.additional_fields).not.toHaveProperty("curp");
    expect(safe.additional_fields).not.toHaveProperty("rfc");
    expect(safe.additional_fields).not.toHaveProperty("second_phone");
    expect(safe.additional_fields).toHaveProperty("desired_salary", 18000);
  });

  it("redactObject scrubs arbitrary nested PII keys", () => {
    const obj = {
      keep: "yes",
      first_name: "Ana",
      nested: { email: "ana@example.com", note: "ok" },
    };
    const safe = redactObject(obj, PII_KEYS_DEFAULT);
    expect(safe).toEqual({ keep: "yes", nested: { note: "ok" } });
  });
});
