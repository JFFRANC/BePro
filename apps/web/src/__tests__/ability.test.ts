import { describe, it, expect } from "vitest";
import { defineAbilityFor } from "@/lib/ability";

describe("defineAbilityFor", () => {
  it("admin can manage all except create Candidate (008 US2)", () => {
    const ability = defineAbilityFor({ role: "admin", id: "1" });
    expect(ability.can("manage", "all")).toBe(true);
    expect(ability.can("delete", "User")).toBe(true);
    // 008-ux-roles-refinements / FR-CG-002 — admins cannot create candidates.
    expect(ability.can("create", "Candidate")).toBe(false);
  });

  it("manager can read all and create/update Placement, but NOT create Candidate (008 US2)", () => {
    const ability = defineAbilityFor({ role: "manager", id: "2" });
    expect(ability.can("read", "Dashboard")).toBe(true);
    expect(ability.can("read", "User")).toBe(true);
    // 008 FR-CG-002 — managers cannot create candidates.
    expect(ability.can("create", "Candidate")).toBe(false);
    expect(ability.can("update", "Candidate")).toBe(true);
    expect(ability.can("update", "Placement")).toBe(true);
    expect(ability.can("delete", "User")).toBe(false);
    expect(ability.can("manage", "all")).toBe(false);
  });

  it("account_executive can read Dashboard/Candidate/Client/Placement and update Candidate/Placement, but NOT create Candidate (008 US2)", () => {
    const ability = defineAbilityFor({ role: "account_executive", id: "3" });
    expect(ability.can("read", "Dashboard")).toBe(true);
    expect(ability.can("read", "Candidate")).toBe(true);
    expect(ability.can("read", "Client")).toBe(true);
    // 008 FR-CG-002 — AEs cannot create candidates.
    expect(ability.can("create", "Candidate")).toBe(false);
    expect(ability.can("update", "Candidate")).toBe(true);
    expect(ability.can("read", "User")).toBe(false);
    expect(ability.can("read", "Audit")).toBe(false);
  });

  it("recruiter can only read Dashboard/Candidate and create Candidate", () => {
    const ability = defineAbilityFor({ role: "recruiter", id: "4" });
    expect(ability.can("read", "Dashboard")).toBe(true);
    expect(ability.can("read", "Candidate")).toBe(true);
    expect(ability.can("create", "Candidate")).toBe(true);
    expect(ability.can("read", "Client")).toBe(false);
    expect(ability.can("update", "Candidate")).toBe(false);
    expect(ability.can("read", "User")).toBe(false);
  });
});
