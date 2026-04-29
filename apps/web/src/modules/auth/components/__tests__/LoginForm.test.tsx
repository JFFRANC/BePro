import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { LoginForm } from "../LoginForm";

const loginMock = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    login: loginMock,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

describe("LoginForm — tenant field visibility (US8)", () => {
  beforeEach(() => {
    loginMock.mockReset();
    loginMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("hides the tenant input and submits the fixed slug when VITE_LOGIN_TENANT_FIXED='bepro'", async () => {
    vi.stubEnv("VITE_LOGIN_TENANT_FIXED", "bepro");
    // Re-import to pick up the stubbed env at module-scope.
    vi.resetModules();
    const { LoginForm: FreshForm } = await import("../LoginForm");

    render(
      <BrowserRouter>
        <FreshForm />
      </BrowserRouter>,
    );

    expect(screen.queryByLabelText(/Organización/i)).toBeNull();

    await userEvent.type(
      screen.getByLabelText(/Email/i),
      "user@bepro.mx",
    );
    await userEvent.type(
      screen.getByLabelText(/Contraseña/i),
      "password1234",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Iniciar sesión/i }),
    );

    await waitFor(() =>
      expect(loginMock).toHaveBeenCalledWith(
        "user@bepro.mx",
        "password1234",
        "bepro",
      ),
    );
  });

  it("renders the tenant input when VITE_LOGIN_TENANT_FIXED is empty", async () => {
    vi.stubEnv("VITE_LOGIN_TENANT_FIXED", "");
    vi.resetModules();
    const { LoginForm: FreshForm } = await import("../LoginForm");

    render(
      <BrowserRouter>
        <FreshForm />
      </BrowserRouter>,
    );

    expect(screen.getByLabelText(/Organización/i)).toBeTruthy();
  });
});
