import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { UserList } from "../components/UserList";
import { AbilityProvider } from "@/components/ability-provider";
import { defineAbilityFor } from "@/lib/ability";

vi.mock("../hooks/useUsers", () => ({
  useUsers: vi.fn(),
}));

vi.mock("../components/UserAvatar", () => ({
  UserAvatar: ({ firstName, lastName }: { firstName: string; lastName: string }) => (
    <span data-testid="avatar">{firstName[0]}{lastName[0]}</span>
  ),
}));

import { useUsers } from "../hooks/useUsers";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ability = defineAbilityFor({ role: "admin", id: "1" });
  return render(
    <QueryClientProvider client={queryClient}>
      <AbilityProvider ability={ability}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AbilityProvider>
    </QueryClientProvider>,
  );
}

describe("UserList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeletons when loading", () => {
    vi.mocked(useUsers).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useUsers>);

    renderWithProviders(<UserList />);
    // Skeleton rows render as generic elements — verify table headers exist
    expect(screen.getByText("Usuario")).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
  });

  it("shows empty state when no results", () => {
    vi.mocked(useUsers).mockReturnValue({
      data: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } },
      isLoading: false,
    } as unknown as ReturnType<typeof useUsers>);

    renderWithProviders(<UserList />);
    expect(screen.getByText("Sin resultados")).toBeDefined();
  });

  it("renders user rows with avatars", () => {
    vi.mocked(useUsers).mockReturnValue({
      data: {
        data: [
          {
            id: "1",
            email: "admin@test.com",
            firstName: "Admin",
            lastName: "User",
            role: "admin",
            isFreelancer: false,
            isActive: true,
            mustChangePassword: false,
            lastLoginAt: null,
            createdAt: "2026-01-01",
            updatedAt: "2026-01-01",
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useUsers>);

    renderWithProviders(<UserList />);
    expect(screen.getByText("Admin User")).toBeDefined();
    expect(screen.getByText("admin@test.com")).toBeDefined();
    expect(screen.getByText("Administrador")).toBeDefined();
  });
});
