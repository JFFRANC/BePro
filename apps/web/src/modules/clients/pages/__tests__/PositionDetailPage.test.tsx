// 011-puestos-profile-docs / US1 — RTL para PositionDetailPage.
//
// Cubre:
//   - Loading skeleton.
//   - Recruiter ve vista read-only (sin formulario editable).
//   - Admin/manager/AE ven el form editable.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PositionDetailPage } from "../PositionDetailPage";
import type { IClientPositionDto } from "@bepro/shared";

const usePositionMock = vi.fn();
vi.mock("../../hooks/useClients", async () => {
  const actual = await vi.importActual<
    typeof import("../../hooks/useClients")
  >("../../hooks/useClients");
  return {
    ...actual,
    usePosition: () => usePositionMock(),
    useClient: () => ({ data: { id: "client-1", name: "ACME" } }),
  };
});

const abilityCanMock = vi.fn();
vi.mock("@/components/ability-provider", () => ({
  useAppAbility: () => ({ can: abilityCanMock }),
}));

const samplePosition: IClientPositionDto = {
  id: "pos-1",
  clientId: "client-1",
  name: "AYUDANTE GENERAL",
  isActive: true,
  createdAt: "2026-04-30T00:00:00.000Z",
  updatedAt: "2026-04-30T00:00:00.000Z",
  vacancies: 80,
  ageMin: 18,
  ageMax: 48,
  gender: "indistinto",
  documents: {},
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/clients/client-1/positions/pos-1"]}>
        <Routes>
          <Route
            path="/clients/:id/positions/:posId"
            element={<PositionDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  usePositionMock.mockReset();
  abilityCanMock.mockReset();
});

describe("011 — PositionDetailPage", () => {
  it("muestra skeleton mientras carga", () => {
    usePositionMock.mockReturnValue({ data: undefined, isLoading: true });
    abilityCanMock.mockReturnValue(true);
    const { container } = renderPage();
    // shadcn Skeleton renderiza un div con `data-slot="skeleton"`
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);
  });

  it("recruiter ve vista read-only (sin form editable, sin botón Guardar)", () => {
    usePositionMock.mockReturnValue({ data: samplePosition, isLoading: false });
    // Recruiter: can("update", "Position") = false
    abilityCanMock.mockReturnValue(false);
    renderPage();
    expect(screen.getByText("AYUDANTE GENERAL")).toBeTruthy();
    expect(screen.getByText(/Perfil del puesto/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Guardar/i })).toBeNull();
  });

  it("AE ve el form editable con defaultValues", () => {
    usePositionMock.mockReturnValue({ data: samplePosition, isLoading: false });
    abilityCanMock.mockImplementation((action: string, subject: string) =>
      action === "update" && subject === "Position",
    );
    renderPage();
    expect(
      (screen.getByLabelText(/Nombre del puesto/i) as HTMLInputElement).value,
    ).toBe("AYUDANTE GENERAL");
    expect(screen.getByRole("button", { name: /Guardar cambios/i })).toBeTruthy();
  });
});
