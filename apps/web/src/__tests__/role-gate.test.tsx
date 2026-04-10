import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AbilityProvider } from "@/components/ability-provider";
import { RoleGate } from "@/components/role-gate";
import { defineAbilityFor } from "@/lib/ability";

function renderWithAbility(role: string, ui: React.ReactElement) {
  const ability = defineAbilityFor({ role: role as any, id: "1" });
  return render(<AbilityProvider ability={ability}>{ui}</AbilityProvider>);
}

describe("RoleGate", () => {
  it("renders children when user has permission", () => {
    renderWithAbility("admin", <RoleGate action="read" subject="User"><p>Visible</p></RoleGate>);
    expect(screen.getByText("Visible")).toBeDefined();
  });

  it("hides children when user lacks permission", () => {
    renderWithAbility("recruiter", <RoleGate action="read" subject="User"><p>Hidden</p></RoleGate>);
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("renders fallback when user lacks permission", () => {
    renderWithAbility("recruiter", <RoleGate action="read" subject="User" fallback={<p>No access</p>}><p>Hidden</p></RoleGate>);
    expect(screen.queryByText("Hidden")).toBeNull();
    expect(screen.getByText("No access")).toBeDefined();
  });
});
