import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { LoginForm } from "../components/LoginForm";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>,
  );
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders email, password, and tenant slug fields", () => {
    renderWithProviders(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/contraseña/i)).toBeDefined();
    expect(screen.getByLabelText(/organización/i)).toBeDefined();
  });

  it("renders submit button", () => {
    renderWithProviders(<LoginForm />);

    const buttons = screen.getAllByRole("button", { name: /iniciar sesión/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the ¿Olvidaste tu contraseña? link to /forgot-password", () => {
    renderWithProviders(<LoginForm />);

    const link = screen.getByRole("link", {
      name: /¿olvidaste tu contraseña\?/i,
    });
    expect(link).toBeDefined();
    expect((link as HTMLAnchorElement).getAttribute("href")).toBe(
      "/forgot-password",
    );
  });
});
