// 008-ux-roles-refinements / US5 — AssignmentTable (polimórfica: AE + reclutador).
//
// Cubre:
//   (a) Dos secciones; fila por AE + por reclutador; usuarios inactivos ocultos.
//   (b) Reclutador con accountExecutiveId seed → líder preseleccionado.
//   (c) Desmarcar un AE que es líder de un reclutador marcado invalida el líder
//       (vuelve a "Sin líder") — no deja un id fantasma en el select.
//   (d) Guardar envía { accountExecutives, recruiters:[{userId, accountExecutiveId?}] }.
//   (e) 4xx con offenders → renderiza mensaje en la fila del ofensor.
//   (f) Restablecer revierte al estado del servidor (checkbox + líder).
//   (g) Guardar queda deshabilitado cuando el estado deseado == estado servidor.
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { AssignmentTable } from "../AssignmentTable";

// --- Mocks ---

// El servicio real exporta `batchAssignClient` (y `listAssignments`). Mockeamos
// ambas funciones tal como las consume el componente vía los hooks.
vi.mock("../../services/clientService", () => ({
  listAssignments: vi.fn().mockResolvedValue([
    // AE "ae-1" ya asignada.
    {
      id: "assg-ae-1",
      clientId: "c1",
      clientName: "Cliente 1",
      userId: "ae-1",
      userFullName: "Ana AE",
      userRole: "account_executive",
    },
    // AE "ae-2" también asignada (es líder de rec-1; el backend garantiza que
    // todo líder está presente en la lista como AE asignada al cliente).
    {
      id: "assg-ae-2",
      clientId: "c1",
      clientName: "Cliente 1",
      userId: "ae-2",
      userFullName: "Luis Martinez",
      userRole: "account_executive",
    },
    // Reclutador "rec-1" ya asignado con líder = ae-2.
    {
      id: "assg-rec-1",
      clientId: "c1",
      clientName: "Cliente 1",
      userId: "rec-1",
      userFullName: "Pablo Recruiter",
      userRole: "recruiter",
      accountExecutiveId: "ae-2",
      accountExecutiveFullName: "Luis Martinez",
    },
  ]),
  batchAssignClient: vi.fn(),
}));

import { batchAssignClient } from "../../services/clientService";

vi.mock("@/modules/users/hooks/useUsers", () => ({
  useUsers: () => ({
    data: {
      data: [
        {
          id: "ae-1",
          firstName: "Ana",
          lastName: "AE",
          email: "ana@example.com",
          role: "account_executive",
          isActive: true,
        },
        {
          id: "ae-2",
          firstName: "Luis",
          lastName: "Martinez",
          email: "luis@example.com",
          role: "account_executive",
          isActive: true,
        },
        {
          id: "rec-1",
          firstName: "Pablo",
          lastName: "Recruiter",
          email: "pablo@example.com",
          role: "recruiter",
          isActive: true,
        },
        {
          id: "rec-2",
          firstName: "Maria",
          lastName: "Reclutadora",
          email: "maria@example.com",
          role: "recruiter",
          isActive: true,
        },
        // Inactivo — NO debe aparecer en la tabla.
        {
          id: "rec-3",
          firstName: "Inactivo",
          lastName: "Usuario",
          email: "inactivo@example.com",
          role: "recruiter",
          isActive: false,
        },
      ],
    },
    isLoading: false,
  }),
}));

// Toasts son efectos laterales — los silenciamos.
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

// Utilidad: el Checkbox (Base UI) no expone `.checked` — usa `aria-checked`.
function isChecked(el: HTMLElement): boolean {
  return el.getAttribute("aria-checked") === "true";
}

describe("AssignmentTable (US5 polimórfica)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (batchAssignClient as unknown as { mockReset: () => void }).mockReset?.();
    (batchAssignClient as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      clientId: "c1",
      added: [],
      removed: [],
      reparented: [],
      unchanged: ["ae-1", "ae-2", "rec-1"],
    });
  });
  afterEach(() => cleanup());

  // (a) Dos secciones, inactivos excluidos.
  it("renderiza dos secciones (AE + reclutadores) y excluye usuarios inactivos", async () => {
    render(wrap(<AssignmentTable clientId="c1" />));
    // Esperamos a que las filas de AE se rendericen (seed asíncrono).
    await screen.findByTestId("ae-row-ae-1");

    // Encabezados de sección presentes.
    expect(screen.getByText(/Ejecutivos de cuenta/i)).toBeTruthy();
    expect(screen.getByText(/Reclutadores/i)).toBeTruthy();

    // 2 AEs activos en la sección AE.
    const aeRow1 = screen.getByTestId("ae-row-ae-1");
    const aeRow2 = screen.getByTestId("ae-row-ae-2");
    expect(within(aeRow1).getByText(/Ana AE/)).toBeTruthy();
    expect(within(aeRow2).getByText(/Luis Martinez/)).toBeTruthy();

    // 2 reclutadores activos en la sección reclutadores.
    const recRow1 = screen.getByTestId("recruiter-row-rec-1");
    const recRow2 = screen.getByTestId("recruiter-row-rec-2");
    expect(within(recRow1).getByText(/Pablo Recruiter/)).toBeTruthy();
    expect(within(recRow2).getByText(/Maria Reclutadora/)).toBeTruthy();

    // Usuario inactivo NO debe tener fila.
    expect(screen.queryByTestId("recruiter-row-rec-3")).toBeNull();
  });

  // (b) Reclutador con líder seed preseleccionado.
  it("precarga el líder del reclutador desde el servidor", async () => {
    render(wrap(<AssignmentTable clientId="c1" />));
    await screen.findByTestId("recruiter-row-rec-1");

    // Checkbox del reclutador marcado (ya asignado).
    const recRow = screen.getByTestId("recruiter-row-rec-1");
    const recCheck = within(recRow).getByRole("checkbox");
    expect(isChecked(recCheck)).toBe(true);

    // El select de líder muestra a Luis (ae-2).
    const leaderSel = within(recRow).getByLabelText(
      /Líder \(AE\) de Pablo Recruiter/i,
    ) as HTMLSelectElement;
    expect(leaderSel.value).toBe("ae-2");
  });

  // (c) Desmarcar AE-líder invalida el líder del reclutador.
  it("invalida el líder del reclutador cuando se desmarca el AE correspondiente", async () => {
    const user = userEvent.setup();
    render(wrap(<AssignmentTable clientId="c1" />));
    await screen.findByTestId("recruiter-row-rec-1");

    // Seed: ae-2 ya está marcado; líder de rec-1 = ae-2.
    const ae2Row = screen.getByTestId("ae-row-ae-2");
    const ae2Check = within(ae2Row).getByRole("checkbox");
    expect(isChecked(ae2Check)).toBe(true);

    const recRow = screen.getByTestId("recruiter-row-rec-1");
    let leaderSel = within(recRow).getByLabelText(
      /Líder \(AE\) de Pablo Recruiter/i,
    ) as HTMLSelectElement;
    expect(leaderSel.value).toBe("ae-2");

    // Desmarcamos ae-2 → el líder debe colapsar a "" (Sin líder),
    // no debe quedar como "ae-2" huérfano.
    await user.click(ae2Check);
    leaderSel = within(recRow).getByLabelText(
      /Líder \(AE\) de Pablo Recruiter/i,
    ) as HTMLSelectElement;
    expect(leaderSel.value).toBe("");
  });

  // (d) Construcción del payload en Guardar.
  it("envía la forma correcta al backend en Guardar", async () => {
    const user = userEvent.setup();
    render(wrap(<AssignmentTable clientId="c1" />));
    await screen.findByTestId("ae-row-ae-1");

    // Marcar rec-2 con líder = ae-1 (nuevo cambio — ae-1 y ae-2 ya están
    // seed-checked, y rec-1 también).
    const rec2Row = screen.getByTestId("recruiter-row-rec-2");
    await user.click(within(rec2Row).getByRole("checkbox"));
    const leaderSel = within(rec2Row).getByLabelText(
      /Líder \(AE\) de Maria Reclutadora/i,
    ) as HTMLSelectElement;
    await user.selectOptions(leaderSel, "ae-1");

    const save = screen.getByRole("button", { name: /guardar/i });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    await user.click(save);

    await waitFor(() => {
      expect(batchAssignClient).toHaveBeenCalledTimes(1);
    });
    const [clientIdArg, payload] = (batchAssignClient as unknown as {
      mock: { calls: unknown[][] };
    }).mock.calls[0] as [
      string,
      {
        accountExecutives: string[];
        recruiters: { userId: string; accountExecutiveId?: string }[];
      },
    ];
    expect(clientIdArg).toBe("c1");
    // ae-1 + ae-2 (seed) — ambos siguen marcados.
    expect(new Set(payload.accountExecutives)).toEqual(
      new Set(["ae-1", "ae-2"]),
    );
    // rec-1 (seed con líder ae-2) + rec-2 (nuevo, líder ae-1).
    const byUser = new Map(
      payload.recruiters.map((r) => [r.userId, r.accountExecutiveId]),
    );
    expect(byUser.get("rec-1")).toBe("ae-2");
    expect(byUser.get("rec-2")).toBe("ae-1");
  });

  // (e) 4xx con offenders → fila muestra el motivo.
  it("muestra la razón inline cuando el backend responde con offenders", async () => {
    const user = userEvent.setup();
    (batchAssignClient as unknown as { mockRejectedValue: (v: unknown) => void }).mockRejectedValue({
      response: {
        status: 422,
        data: {
          error: "user_inactive",
          message: "Uno o más usuarios están inactivos.",
          offenders: [{ userId: "rec-2", reason: "inactive" }],
        },
      },
    });

    render(wrap(<AssignmentTable clientId="c1" />));
    await screen.findByTestId("recruiter-row-rec-2");

    // Forzar un cambio para habilitar Guardar.
    const rec2Row = screen.getByTestId("recruiter-row-rec-2");
    await user.click(within(rec2Row).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(within(rec2Row).getByText(/Usuario inactivo/i)).toBeTruthy();
    });
  });

  // (f) Restablecer restaura el estado servidor.
  it("Restablecer restaura checkboxes y líder al estado del servidor", async () => {
    const user = userEvent.setup();
    render(wrap(<AssignmentTable clientId="c1" />));
    await screen.findByTestId("recruiter-row-rec-1");

    // Seed: ae-1 ✓, ae-2 ✓, rec-1 ✓ con líder ae-2.
    const ae2Row = screen.getByTestId("ae-row-ae-2");
    // Desmarcamos ae-2 (cambio local).
    await user.click(within(ae2Row).getByRole("checkbox"));
    // Marcamos rec-2 (cambio local).
    const rec2Row = screen.getByTestId("recruiter-row-rec-2");
    await user.click(within(rec2Row).getByRole("checkbox"));

    // Sanity: hay cambios.
    expect(
      (screen.getByRole("button", { name: /guardar/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: /restablecer/i }));

    // Vuelve al estado seed.
    const ae2Check = within(ae2Row).getByRole("checkbox");
    expect(isChecked(ae2Check)).toBe(true);
    const rec2Check = within(rec2Row).getByRole("checkbox");
    expect(isChecked(rec2Check)).toBe(false);
    const recRow = screen.getByTestId("recruiter-row-rec-1");
    const leaderSelAfter = within(recRow).getByLabelText(
      /Líder \(AE\) de Pablo Recruiter/i,
    ) as HTMLSelectElement;
    expect(leaderSelAfter.value).toBe("ae-2");
    expect(
      (screen.getByRole("button", { name: /guardar/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  // (g) Sin cambios → Guardar/Restablecer deshabilitados.
  it("deshabilita Guardar y Restablecer cuando el estado deseado coincide con el servidor", async () => {
    render(wrap(<AssignmentTable clientId="c1" />));
    await screen.findByTestId("ae-row-ae-1");

    const save = screen.getByRole("button", { name: /guardar/i });
    const reset = screen.getByRole("button", { name: /restablecer/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    expect((reset as HTMLButtonElement).disabled).toBe(true);
  });

  // (h) Toast de éxito: si reparented = 0, omitir el sufijo "re-asignadas".
  it("omite el sufijo 're-asignadas' del toast cuando reparented es 0", async () => {
    const user = userEvent.setup();
    (batchAssignClient as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      clientId: "c1",
      added: [{ userId: "rec-2", role: "recruiter", at: "2026-04-24T00:00:00Z" }],
      removed: [],
      reparented: [],
      unchanged: ["ae-1", "ae-2", "rec-1"],
    });

    render(wrap(<AssignmentTable clientId="c1" />));
    await screen.findByTestId("recruiter-row-rec-2");

    // Forzar un cambio para habilitar Guardar.
    const rec2Row = screen.getByTestId("recruiter-row-rec-2");
    await user.click(within(rec2Row).getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
    const successCalls = (toast.success as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const lastMessage = successCalls[successCalls.length - 1][0] as string;
    expect(lastMessage).toMatch(/1 agregadas/);
    expect(lastMessage).toMatch(/0 removidas/);
    // Sin reparenting: el sufijo no debe aparecer.
    expect(lastMessage).not.toMatch(/re-asignadas/);
  });

  // (i) Toast de éxito: si reparented > 0, incluir el sufijo "re-asignadas".
  it("incluye el sufijo 're-asignadas' del toast cuando reparented es mayor a 0", async () => {
    const user = userEvent.setup();
    (batchAssignClient as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      clientId: "c1",
      added: [],
      removed: [],
      reparented: [
        { userId: "rec-1", from: "ae-2", to: "ae-1", at: "2026-04-24T00:00:00Z" },
      ],
      unchanged: ["ae-1", "ae-2"],
    });

    render(wrap(<AssignmentTable clientId="c1" />));
    await screen.findByTestId("recruiter-row-rec-1");

    // Cambiar líder de rec-1 (ae-2 → ae-1) para habilitar Guardar.
    const recRow = screen.getByTestId("recruiter-row-rec-1");
    const leaderSel = within(recRow).getByLabelText(
      /Líder \(AE\) de Pablo Recruiter/i,
    ) as HTMLSelectElement;
    await user.selectOptions(leaderSel, "ae-1");
    await user.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
    const successCalls = (toast.success as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const lastMessage = successCalls[successCalls.length - 1][0] as string;
    expect(lastMessage).toMatch(/1 re-asignadas/);
  });
});
