import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormLayout, FormSection, FormField, FormRow } from "@/components/form-layout";

describe("FormLayout", () => {
  it("renders title and description", () => {
    render(<FormLayout title="Registro" description="Completa los datos"><p>Fields</p></FormLayout>);
    expect(screen.getByText("Registro")).toBeDefined();
    expect(screen.getByText("Completa los datos")).toBeDefined();
    expect(screen.getByText("Fields")).toBeDefined();
  });
});

describe("FormSection", () => {
  it("renders section title", () => {
    render(<FormSection title="Datos personales"><p>Content</p></FormSection>);
    expect(screen.getByText("Datos personales")).toBeDefined();
    expect(screen.getByText("Content")).toBeDefined();
  });
});

describe("FormField", () => {
  it("renders label and error", () => {
    render(<FormField label="Nombre" error="Campo requerido"><input /></FormField>);
    expect(screen.getByText("Nombre")).toBeDefined();
    expect(screen.getByText("Campo requerido")).toBeDefined();
  });

  it("renders without error when not provided", () => {
    render(<FormField label="Email"><input /></FormField>);
    expect(screen.getByText("Email")).toBeDefined();
  });
});

describe("FormRow", () => {
  it("renders children in a grid", () => {
    render(<FormRow><p>A</p><p>B</p></FormRow>);
    expect(screen.getByText("A")).toBeDefined();
    expect(screen.getByText("B")).toBeDefined();
  });
});
