import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ErrorPage } from "@/components/error-page";

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ErrorPage", () => {
  it("renders 403 with correct title and description", () => {
    renderWithRouter(<ErrorPage code={403} />);
    expect(screen.getByText("Acceso denegado")).toBeDefined();
    expect(screen.getByText("No tienes permisos para ver esta página")).toBeDefined();
    expect(screen.getByText("Ir al Dashboard")).toBeDefined();
  });

  it("renders 404 with correct title", () => {
    renderWithRouter(<ErrorPage code={404} />);
    expect(screen.getByText("Página no encontrada")).toBeDefined();
  });

  it("renders 500 with retry button", () => {
    renderWithRouter(<ErrorPage code={500} onRetry={() => {}} />);
    expect(screen.getByText("Error del servidor")).toBeDefined();
    expect(screen.getByText("Reintentar")).toBeDefined();
  });

  it("renders custom title and description", () => {
    renderWithRouter(<ErrorPage code={403} title="Custom" description="Custom desc" />);
    expect(screen.getByText("Custom")).toBeDefined();
    expect(screen.getByText("Custom desc")).toBeDefined();
  });
});
