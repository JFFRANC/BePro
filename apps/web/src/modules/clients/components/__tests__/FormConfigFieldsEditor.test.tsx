// 008-ux-roles-refinements / US6 — FormConfigFieldsEditor smoke tests.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { FormConfigFieldsEditor } from "../FormConfigFieldsEditor";
import type { IClientDetailDto } from "@bepro/shared";

vi.mock("../../services/clientService", () => ({
  createFormConfigField: vi.fn(),
  patchFormConfigField: vi.fn(),
}));

function wrap(children: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function clientWith(fields: unknown[] = []): IClientDetailDto {
  // Minimal shape used by the editor — other fields unused in these tests.
  return {
    id: "c1",
    name: "Cliente Demo",
    isActive: true,
    formConfig: {
      showAge: true,
      showPlant: true,
      showShift: false,
      showComments: true,
      showPosition: false,
      showMunicipality: true,
      showInterviewTime: false,
      showInterviewPoint: false,
      fields,
    },
    contacts: [],
    positions: [],
    assignments: [],
    createdAt: "2026-04-21T00:00:00Z",
    updatedAt: "2026-04-21T00:00:00Z",
  } as unknown as IClientDetailDto;
}

describe("FormConfigFieldsEditor (US6)", () => {
  afterEach(() => cleanup());

  it("renders an empty-state when the client has no custom fields", () => {
    render(wrap(<FormConfigFieldsEditor client={clientWith([])} />));
    expect(screen.getByText(/Sin campos personalizados/i)).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /añadir campo/i }),
    ).toBeTruthy();
  });

  it("renders existing custom fields in a table with their key, label, type and state", () => {
    const iso = "2026-04-21T00:00:00.000Z";
    render(
      wrap(
        <FormConfigFieldsEditor
          client={clientWith([
            {
              key: "contract_number",
              label: "Número de contrato",
              type: "text",
              required: false,
              options: null,
              archived: false,
              createdAt: iso,
              updatedAt: iso,
            },
            {
              key: "shift",
              label: "Turno",
              type: "select",
              required: true,
              options: ["día", "noche"],
              archived: true,
              createdAt: iso,
              updatedAt: iso,
            },
          ])}
        />,
      ),
    );
    expect(screen.getByText("contract_number")).toBeTruthy();
    expect(screen.getByText(/Número de contrato/i)).toBeTruthy();
    expect(screen.getByText(/Archivado/i)).toBeTruthy();
    // Restaurar button for the archived field.
    expect(screen.getByRole("button", { name: /restaurar/i })).toBeTruthy();
  });

  it("FR-FC-005 — the 8 legacy toggles are preserved in formConfig alongside fields[]", () => {
    // This is a regression guard: the editor reads `fields` via `formConfig.fields`
    // and does not mutate the legacy toggles. Verify by ensuring the client
    // object's legacy keys are untouched after render.
    const client = clientWith([]);
    render(wrap(<FormConfigFieldsEditor client={client} />));
    const fc = client.formConfig as unknown as Record<string, unknown>;
    expect(fc.showAge).toBe(true);
    expect(fc.showMunicipality).toBe(true);
    expect(fc.showComments).toBe(true);
    expect(fc.showInterviewTime).toBe(false);
  });
});
