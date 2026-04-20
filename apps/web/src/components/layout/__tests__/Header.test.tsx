import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithRouter } from "./render-helpers";

vi.mock("@/modules/auth/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: "u1",
      email: "x@x.com",
      firstName: "Ada",
      lastName: "Lovelace",
      role: "admin",
      tenantId: "tenant-bepro",
      isFreelancer: false,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  })),
}));

import { Header } from "../Header";

describe("Header", () => {
  afterEach(() => cleanup());

  it("is sticky at the top of the viewport", () => {
    const { container } = renderWithRouter(<Header />);
    const header = container.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.className).toContain("sticky");
    expect(header!.className).toContain("top-0");
  });

  it("renders the TenantBadge in the left cluster", () => {
    const { container } = renderWithRouter(<Header />);
    const left = container.querySelector("[data-slot='header-left']");
    expect(left).not.toBeNull();
    expect(left!.querySelector("[data-slot='tenant-badge']")).not.toBeNull();
  });

  it("exposes a right cluster slot for later utilities", () => {
    const { container } = renderWithRouter(<Header />);
    const right = container.querySelector("[data-slot='header-right']");
    expect(right).not.toBeNull();
  });

  it("includes the brand name", () => {
    renderWithRouter(<Header />);
    expect(screen.getByText(/^BePro$/)).not.toBeNull();
  });

  it("uses h-14 so the sidebar's --header-height contract holds", () => {
    const { container } = renderWithRouter(<Header />);
    const header = container.querySelector("header");
    expect(header!.className).toContain("h-14");
  });

  it("stacks under the OfflineBanner via z-40 (banner is z-50)", () => {
    const { container } = renderWithRouter(<Header />);
    const header = container.querySelector("header");
    expect(header!.className).toContain("z-40");
  });

  it("renders without crashing when the user is null", async () => {
    const { useAuth } = await import("@/modules/auth/hooks/useAuth");
    vi.mocked(useAuth).mockReturnValueOnce({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    const { container } = renderWithRouter(<Header />);
    expect(container.querySelector("header")).not.toBeNull();
  });
});
