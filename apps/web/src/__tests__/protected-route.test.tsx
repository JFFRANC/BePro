import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AbilityProvider } from "@/components/ability-provider";
import { ProtectedRoute } from "@/components/protected-route";
import { defineAbilityFor } from "@/lib/ability";

function renderWithAbility(role: string, action: string, subject: string) {
  const ability = defineAbilityFor({ role: role as any, id: "1" });
  return render(
    <AbilityProvider ability={ability}>
      <MemoryRouter initialEntries={["/test"]}>
        <Routes>
          <Route
            path="/test"
            element={
              <ProtectedRoute action={action as any} subject={subject as any} />
            }
          >
            <Route index element={<p>Protected content</p>} />
          </Route>
          <Route path="/403" element={<p>Acceso denegado</p>} />
        </Routes>
      </MemoryRouter>
    </AbilityProvider>
  );
}

describe("ProtectedRoute", () => {
  it("renders outlet when authorized", () => {
    renderWithAbility("admin", "read", "User");
    expect(screen.getByText("Protected content")).toBeDefined();
  });

  it("redirects to /403 and renders error page when unauthorized", () => {
    renderWithAbility("recruiter", "read", "User");
    expect(screen.getByText("Acceso denegado")).toBeDefined();
  });
});
