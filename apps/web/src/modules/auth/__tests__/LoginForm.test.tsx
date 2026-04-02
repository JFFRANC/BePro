import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
