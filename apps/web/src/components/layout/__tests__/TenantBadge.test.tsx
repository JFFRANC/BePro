import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithRouter } from "./render-helpers";

vi.mock("@/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/modules/auth/hooks/useAuth";
import { TenantBadge } from "../TenantBadge";

const mockedUseAuth = vi.mocked(useAuth);

function setUser(overrides: Record<string, unknown> = {}) {
  mockedUseAuth.mockReturnValue({
    user: {
      id: "u1",
      email: "x@x.com",
      firstName: "Ada",
      lastName: "Lovelace",
      role: "admin",
      tenantId: "tenant-bepro",
      isFreelancer: false,
      mustChangePassword: false,
      ...overrides,
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
}

describe("TenantBadge", () => {
  afterEach(() => {
    cleanup();
    mockedUseAuth.mockReset();
  });

  it("renders brand text along with a logo", () => {
    setUser();
    renderWithRouter(<TenantBadge />);
    expect(screen.getByText(/^BePro$/)).not.toBeNull();
    // Logo/icon marker — svg element inside the badge
    const svgs = document.querySelectorAll("[data-slot='tenant-badge'] svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("truncates long tenant identifiers and exposes the full value via title", () => {
    setUser({ tenantId: "this-is-an-unusually-long-tenant-identifier-value" });
    renderWithRouter(<TenantBadge />);
    const label = document.querySelector("[data-slot='tenant-badge-label']");
    expect(label).not.toBeNull();
    expect(label?.className).toContain("truncate");
    expect(label?.getAttribute("title")).toContain(
      "this-is-an-unusually-long-tenant-identifier-value",
    );
  });

  it("still renders when user is null", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    renderWithRouter(<TenantBadge />);
    expect(screen.getByText(/^BePro$/)).not.toBeNull();
  });
});
