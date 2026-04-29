import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

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

import { apiClient } from "@/lib/api-client";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>,
  );
}

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the email field and submit button", () => {
    renderWithProviders(<ForgotPasswordForm />);

    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /enviar enlace/i }),
    ).toBeDefined();
  });

  it("calls the API and shows the Spanish confirmation on success", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        message:
          "Si la cuenta existe, te hemos enviado un enlace para restablecer tu contraseña.",
      },
    });

    renderWithProviders(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/auth/password-reset/request",
        { email: "user@example.com" },
        expect.objectContaining({
          headers: expect.objectContaining({ "X-Requested-With": "fetch" }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("status").textContent ?? "").toMatch(
        /si la cuenta existe/i,
      );
    });
  });
});
