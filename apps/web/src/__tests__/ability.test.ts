import { describe, it, expect } from "vitest";
import { defineAbilityFor } from "@/lib/ability";

describe("defineAbilityFor", () => {
  it("admin can manage all", () => {
    const ability = defineAbilityFor({ role: "admin", id: "1" });
    expect(ability.can("manage", "all")).toBe(true);
    expect(ability.can("delete", "User")).toBe(true);
    expect(ability.can("create", "Candidate")).toBe(true);
  });

  it("manager can read all and create/update Candidate/Placement", () => {
    const ability = defineAbilityFor({ role: "manager", id: "2" });
    expect(ability.can("read", "Dashboard")).toBe(true);
    expect(ability.can("read", "User")).toBe(true);
    expect(ability.can("create", "Candidate")).toBe(true);
    expect(ability.can("update", "Placement")).toBe(true);
    expect(ability.can("delete", "User")).toBe(false);
    expect(ability.can("manage", "all")).toBe(false);
  });

  it("account_executive can read Dashboard/Candidate/Client/Placement, create/update Candidate/Placement", () => {
    const ability = defineAbilityFor({ role: "account_executive", id: "3" });
    expect(ability.can("read", "Dashboard")).toBe(true);
    expect(ability.can("read", "Candidate")).toBe(true);
    expect(ability.can("read", "Client")).toBe(true);
    expect(ability.can("create", "Candidate")).toBe(true);
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
