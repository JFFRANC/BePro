// 010-user-client-assignment / US1+US3 — RTL para CreateUserForm.
//
// Comportamientos cubiertos:
//   - Cliente Select sólo aparece para roles account_executive / recruiter (US1)
//   - Cliente Select se OCULTA para roles admin / manager (US3)
//   - Al cambiar de role AE/recruiter → admin/manager, clientId se limpia (US3)
//   - El submit envía clientId al hook de mutación (US1)
//   - Cuando la mutación devuelve 400 "cliente inactivo o inexistente",
//     el form invalida la query de clientes activos (US1 / FR-007 / Q5)
//
// Notas de testing:
//   - shadcn/base-ui Select requiere `keyboard("{Enter}")` (no click) para
//     abrir el popover en jsdom — usamos los helpers `pickFromSelect` /
//     `openSelectByTestId` de test-utils.
//   - `cleanup()` global ya está configurado en vitest.setup.ts.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateUserForm } from "../components/CreateUserForm";
import { pickFromSelect } from "@/test-utils/select";

// Mock hooks
const mutateAsync = vi.fn();
vi.mock("../hooks/useUsers", () => ({
  useCreateUser: () => ({ mutateAsync, isPending: false }),
}));

const useActiveClientsMock = vi.fn();
vi.mock("../hooks/useActiveClients", () => ({
  useActiveClients: () => useActiveClientsMock(),
  ACTIVE_CLIENTS_QUERY_KEY: ["clients", "activeList"] as const,
}));

vi.mock("sonner", async () => {
  const actual = await vi.importActual<typeof import("sonner")>("sonner");
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

const VALID_CLIENT_ID = "1c1c63d9-2b5a-4f7e-9d1a-2cd2af1fbb0e";
const ANOTHER_CLIENT_ID = "2c2c63d9-2b5a-4f7e-9d1a-2cd2af1fbb0e";

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <CreateUserForm onSuccess={vi.fn()} onCancel={vi.fn()} />
      </QueryClientProvider>,
    ),
  };
}

const pickRole = (
  user: ReturnType<typeof userEvent.setup>,
  optionText: RegExp | string,
) => pickFromSelect(user, "select-rol", optionText);

const pickCliente = (
  user: ReturnType<typeof userEvent.setup>,
  optionText: RegExp | string,
) => pickFromSelect(user, "select-cliente", optionText);

beforeEach(() => {
  mutateAsync.mockReset();
  useActiveClientsMock.mockReset();
  useActiveClientsMock.mockReturnValue({
    data: [
      { id: VALID_CLIENT_ID, name: "ACME" },
      { id: ANOTHER_CLIENT_ID, name: "Globex" },
    ],
    isLoading: false,
    isError: false,
  });
});


describe("CreateUserForm — Cliente field visibility per role (US1 + US3)", () => {
  it("renders the Cliente select when role is recruiter (default)", () => {
    renderForm();
    expect(screen.getAllByTestId("select-cliente")[0]).toBeDefined();
  });

  it("renders the Cliente select when role is account_executive", async () => {
    const { user } = renderForm();
    await pickRole(user, /ejecutivo de cuenta/i);
    expect(screen.getAllByTestId("select-cliente")[0]).toBeDefined();
  });

  it("HIDES the Cliente select when role is admin", async () => {
    const { user } = renderForm();
    await pickRole(user, /administrador/i);
    // Confirm the role actually changed at the trigger level before we assert
    // about the conditional render (debug-friendly, fails fast if pickRole
    // didn't take effect for any reason).
    await waitFor(() => {
      const trigger = screen.getAllByTestId("select-rol")[0];
      expect(trigger.textContent ?? "").toMatch(/admin/i);
    });
    expect(screen.queryAllByTestId("select-cliente")[0] ?? null).toBeNull();
  });

  it("HIDES the Cliente select when role is manager", async () => {
    const { user } = renderForm();
    await pickRole(user, /^gerente$/i);
    await waitFor(() => {
      const trigger = screen.getAllByTestId("select-rol")[0];
      expect(trigger.textContent ?? "").toMatch(/manager|gerente/i);
    });
    expect(screen.queryAllByTestId("select-cliente")[0] ?? null).toBeNull();
  });
});

describe("CreateUserForm — submit pipeline (US1)", () => {
  it("passes clientId in the mutation payload when role is recruiter", async () => {
    mutateAsync.mockResolvedValue({});
    const { user } = renderForm();

    await user.type(screen.getByLabelText(/^Nombre/), "Ana");
    await user.type(screen.getByLabelText(/^Apellido/), "López");
    await user.type(screen.getByLabelText(/^Correo electrónico/), "ana@bepro.mx");
    await user.type(screen.getByLabelText(/^Contraseña/), "Sup3rSecret!");

    // Pick the Cliente
    await pickCliente(user, "ACME");

    await user.click(screen.getAllByRole("button", { name: /Crear usuario/ })[0]);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ana@bepro.mx",
        role: "recruiter",
        clientId: VALID_CLIENT_ID,
      }),
    );
  });

  it("does NOT pass clientId for role=admin even with stale state in form (US3 defensive)", async () => {
    mutateAsync.mockResolvedValue({});
    const { user } = renderForm();

    // Pick a client first (while role is recruiter)
    await pickCliente(user, "ACME");

    // Now switch to admin (this MUST clear the clientId)
    await pickRole(user, /administrador/i);

    await user.type(screen.getByLabelText(/^Nombre/), "Boss");
    await user.type(screen.getByLabelText(/^Apellido/), "Admin");
    await user.type(screen.getByLabelText(/^Correo electrónico/), "boss@bepro.mx");
    await user.type(screen.getByLabelText(/^Contraseña/), "Sup3rSecret!");

    await user.click(screen.getAllByRole("button", { name: /Crear usuario/ })[0]);

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0][0] as { clientId?: string };
    expect(payload.clientId).toBeUndefined();
  });
});

describe("CreateUserForm — error recovery on inactive-client 400 (US1 / Q5)", () => {
  it("invalidates the active-clients query when the API returns 400 'cliente inactivo o inexistente'", async () => {
    const apiErr = {
      response: {
        status: 400,
        data: { error: "cliente inactivo o inexistente" },
      },
    };
    mutateAsync.mockRejectedValue(apiErr);

    const { queryClient, user } = renderForm();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await user.type(screen.getByLabelText(/^Nombre/), "Ana");
    await user.type(screen.getByLabelText(/^Apellido/), "López");
    await user.type(screen.getByLabelText(/^Correo electrónico/), "ana@bepro.mx");
    await user.type(screen.getByLabelText(/^Contraseña/), "Sup3rSecret!");
    await pickCliente(user, "ACME");

    await user.click(screen.getAllByRole("button", { name: /Crear usuario/ })[0]);

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["clients", "activeList"] }),
      ),
    );
  });
});
