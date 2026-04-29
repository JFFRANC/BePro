import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ResetPasswordForm } from "../components/ResetPasswordForm";

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

const VALID_TOKEN = "a".repeat(43);

function renderAt(path: string, ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/reset-password" element={ui} />
          <Route path="/" element={<div>Dashboard</div>} />
          <Route path="/forgot-password" element={<div>Forgot</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("reads ?token= from the URL and submits it on a successful reset", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        accessToken: "mock-token",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        user: {
          id: "u-1",
          email: "user@example.com",
          firstName: "Juan",
          lastName: "Perez",
          role: "admin",
          tenantId: "t-1",
          isFreelancer: false,
          mustChangePassword: false,
        },
      },
    });

    renderAt(
      `/reset-password?token=${VALID_TOKEN}`,
      <ResetPasswordForm />,
    );

    const newPassword = screen.getByLabelText(/^nueva contraseña$/i);
    const confirmPassword = screen.getByLabelText(/confirmar contraseña/i);
    await user.type(newPassword, "NewPa55!word");
    await user.type(confirmPassword, "NewPa55!word");
    await user.click(
      screen.getByRole("button", { name: /establecer contraseña/i }),
    );

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/auth/password-reset/confirm",
        { token: VALID_TOKEN, password: "NewPa55!word" },
        expect.objectContaining({
          headers: expect.objectContaining({ "X-Requested-With": "fetch" }),
        }),
      );
    });

    // The navigate("/") effect lands the user on the dashboard.
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeDefined();
    });
  });

  it("renders the inline expired/used Spanish message + Solicitar otro enlace button when token is missing", () => {
    renderAt("/reset-password", <ResetPasswordForm />);

    expect(screen.getByRole("alert").textContent ?? "").toMatch(
      /el enlace ha expirado o ya fue utilizado/i,
    );
    expect(
      screen.getByRole("link", { name: /solicitar otro enlace/i }),
    ).toBeDefined();
  });

  it("renders the same expired message when the API returns an error", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.post).mockRejectedValue({
      response: {
        status: 400,
        data: { error: "el enlace ha expirado, solicita uno nuevo" },
      },
    });

    renderAt(
      `/reset-password?token=${VALID_TOKEN}`,
      <ResetPasswordForm />,
    );

    const newPassword = screen.getByLabelText(/^nueva contraseña$/i);
    const confirmPassword = screen.getByLabelText(/confirmar contraseña/i);
    await user.type(newPassword, "NewPa55!word");
    await user.type(confirmPassword, "NewPa55!word");
    await user.click(
      screen.getByRole("button", { name: /establecer contraseña/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent ?? "").toMatch(
        /el enlace ha expirado o ya fue utilizado/i,
      );
    });
  });
});
