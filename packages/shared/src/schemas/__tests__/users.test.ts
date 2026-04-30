// 010-user-client-assignment / Foundational — createUserSchema clientId refinement.
import { describe, it, expect } from "vitest";
import { createUserSchema } from "../users.js";

const validUuid = "1c1c63d9-2b5a-4f7e-9d1a-2cd2af1fbb0e";

const baseValid = {
  email: "ana.lopez@bepro.mx",
  password: "Sup3rSecret!",
  firstName: "Ana",
  lastName: "López",
  isFreelancer: false,
};

describe("createUserSchema clientId refinement (010 / FR-002)", () => {
  it("requires clientId for role=account_executive", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "account_executive",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "clientId");
      expect(issue).toBeDefined();
      expect(issue?.message).toBe("Cliente es requerido para este rol");
    }
  });

  it("requires clientId for role=recruiter", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "recruiter",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "clientId");
      expect(issue).toBeDefined();
    }
  });

  it("requires clientId for role=recruiter even with isFreelancer=true", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "recruiter",
      isFreelancer: true,
    });
    expect(r.success).toBe(false);
  });

  it("accepts clientId for role=account_executive when supplied", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "account_executive",
      clientId: validUuid,
    });
    expect(r.success).toBe(true);
  });

  it("accepts clientId for role=recruiter when supplied", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "recruiter",
      clientId: validUuid,
    });
    expect(r.success).toBe(true);
  });

  it("does not require clientId for role=admin", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "admin",
    });
    expect(r.success).toBe(true);
  });

  it("does not require clientId for role=manager", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "manager",
    });
    expect(r.success).toBe(true);
  });

  it("tolerates a stray clientId for role=admin (defensive — server drops it)", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "admin",
      clientId: validUuid,
    });
    expect(r.success).toBe(true);
  });

  it("tolerates a stray clientId for role=manager (defensive — server drops it)", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "manager",
      clientId: validUuid,
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed clientId regardless of role", () => {
    const r = createUserSchema.safeParse({
      ...baseValid,
      role: "recruiter",
      clientId: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });
});
