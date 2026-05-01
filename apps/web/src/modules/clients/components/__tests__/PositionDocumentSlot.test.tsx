// 011-puestos-profile-docs / US2+US3 — RTL para PositionDocumentSlot.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PositionDocumentSlot } from "../PositionDocumentSlot";
import type { IClientPositionDto } from "@bepro/shared";

const uploadMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
vi.mock("../../hooks/useClients", async () => {
  const actual = await vi.importActual<
    typeof import("../../hooks/useClients")
  >("../../hooks/useClients");
  return {
    ...actual,
    useUploadPositionDocument: () => ({
      mutateAsync: uploadMutateAsync,
      isPending: false,
    }),
    useSoftDeletePositionDocument: () => ({
      mutateAsync: deleteMutateAsync,
      isPending: false,
    }),
  };
});

const abilityCanMock = vi.fn();
vi.mock("@/components/ability-provider", () => ({
  useAppAbility: () => ({ can: abilityCanMock }),
}));

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner");
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
  };
});

const basePosition: IClientPositionDto = {
  id: "pos-1",
  clientId: "client-1",
  name: "Ayudante",
  isActive: true,
  createdAt: "",
  updatedAt: "",
  documents: {},
};

function renderSlot(over: Partial<IClientPositionDto> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PositionDocumentSlot
        clientId="client-1"
        positionId="pos-1"
        type="contract"
        position={{ ...basePosition, ...over }}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  uploadMutateAsync.mockReset();
  deleteMutateAsync.mockReset();
  abilityCanMock.mockReset();
});

describe("011 — PositionDocumentSlot", () => {
  it("muestra estado vacío con botón 'Subir contrato' para AE", () => {
    abilityCanMock.mockImplementation((action: string, subject: string) =>
      action === "update" && subject === "PositionDocument",
    );
    renderSlot();
    expect(screen.getByText(/Sin documento/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Subir contrato/i })).toBeTruthy();
  });

  it("recruiter (read-only) NO ve botón de subir cuando el slot está vacío", () => {
    abilityCanMock.mockReturnValue(false);
    renderSlot();
    expect(screen.getByText(/Sin documento/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Subir contrato/i })).toBeNull();
  });

  it("muestra acciones Descargar + Reemplazar cuando hay activo", () => {
    abilityCanMock.mockImplementation((action: string, subject: string) =>
      action === "update" && subject === "PositionDocument",
    );
    renderSlot({ documents: { contract: { id: "doc-1" } } });
    expect(screen.getByRole("button", { name: /Descargar/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reemplazar/i })).toBeTruthy();
  });

  it("recruiter sólo ve Descargar (no Reemplazar/Eliminar)", () => {
    abilityCanMock.mockReturnValue(false);
    renderSlot({ documents: { contract: { id: "doc-1" } } });
    expect(screen.getByRole("button", { name: /Descargar/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Reemplazar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Eliminar/i })).toBeNull();
  });

  it("admin ve además Eliminar", () => {
    abilityCanMock.mockImplementation((action: string, subject: string) => {
      if (action === "manage" && subject === "all") return true;
      if (action === "update" && subject === "PositionDocument") return true;
      return false;
    });
    renderSlot({ documents: { contract: { id: "doc-1" } } });
    expect(screen.getByRole("button", { name: /Eliminar/i })).toBeTruthy();
  });

  it("rechaza un .txt cliente-side antes de la mutación (FR-013)", async () => {
    abilityCanMock.mockImplementation((action: string, subject: string) =>
      action === "update" && subject === "PositionDocument",
    );
    const { container } = renderSlot();
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    // userEvent.upload no dispara change en un input hidden (display:none).
    // Usamos fireEvent.change con un FileList sintético.
    const file = new File(["hello"], "x.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(uploadMutateAsync).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText(/Formato no permitido/i)).toBeTruthy(),
    );
  });
});
