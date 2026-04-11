import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { IClientFormConfig } from "@bepro/shared";
import { DynamicCandidateForm } from "@/components/dynamic-form";

afterEach(() => cleanup());

const allEnabled: IClientFormConfig = {
  showInterviewTime: true, showPosition: true, showMunicipality: true,
  showAge: true, showShift: true, showPlant: true,
  showInterviewPoint: true, showComments: true,
};

const allDisabled: IClientFormConfig = {
  showInterviewTime: false, showPosition: false, showMunicipality: false,
  showAge: false, showShift: false, showPlant: false,
  showInterviewPoint: false, showComments: false,
};

describe("DynamicCandidateForm", () => {
  it("always renders required fields", () => {
    render(<DynamicCandidateForm formConfig={allDisabled} clientName="Empresa A" onSubmit={vi.fn()} />);
    expect(screen.getByText("Nombre completo")).toBeDefined();
    expect(screen.getByText("Teléfono")).toBeDefined();
    expect(screen.getByText("Fecha de entrevista")).toBeDefined();
    expect(screen.getByText("Cliente")).toBeDefined();
  });

  it("shows optional fields when config enables them", () => {
    render(<DynamicCandidateForm formConfig={allEnabled} clientName="Empresa A" onSubmit={vi.fn()} />);
    expect(screen.getByText("Puesto")).toBeDefined();
    expect(screen.getByText("Edad")).toBeDefined();
    expect(screen.getByText("Turno")).toBeDefined();
    expect(screen.getByText("Planta")).toBeDefined();
    expect(screen.getByText("Punto de entrevista")).toBeDefined();
    expect(screen.getByText("Observaciones")).toBeDefined();
    expect(screen.getByText("Hora de entrevista")).toBeDefined();
  });

  it("hides optional fields when config disables them", () => {
    render(<DynamicCandidateForm formConfig={allDisabled} clientName="Empresa A" onSubmit={vi.fn()} />);
    expect(screen.queryByText("Puesto")).toBeNull();
    expect(screen.queryByText("Edad")).toBeNull();
    expect(screen.queryByText("Turno")).toBeNull();
    expect(screen.queryByText("Planta")).toBeNull();
  });
});
