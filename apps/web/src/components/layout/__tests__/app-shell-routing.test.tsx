import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShellLayout } from "../AppShellLayout";

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

function MiniApp({ route }: { route: string }) {
  return (
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login">LOGIN</div>} />
        <Route
          path="/design-system"
          element={<div data-testid="design-system">DS</div>}
        />
        <Route
          path="/change-password"
          element={<div data-testid="change-password">CP</div>}
        />
        <Route element={<AppShellLayout />}>
          <Route path="/" element={<div data-testid="dash">DASH</div>} />
          <Route path="/users" element={<div data-testid="users">USERS</div>} />
        </Route>
        <Route path="*" element={<div data-testid="nf">NOT FOUND</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AppShellLayout routing (FR-026)", () => {
  afterEach(() => cleanup());

  it("renders shell chrome on routes nested under AppShellLayout", () => {
    const { container } = render(<MiniApp route="/" />);
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector("aside")).not.toBeNull();
    expect(screen.getByTestId("dash")).not.toBeNull();
  });

  it("does NOT render shell on /login", () => {
    const { container } = render(<MiniApp route="/login" />);
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByTestId("login")).not.toBeNull();
  });

  it("does NOT render shell on /design-system", () => {
    const { container } = render(<MiniApp route="/design-system" />);
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByTestId("design-system")).not.toBeNull();
  });

  it("does NOT render shell on /change-password", () => {
    const { container } = render(<MiniApp route="/change-password" />);
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByTestId("change-password")).not.toBeNull();
  });

  it("does NOT render shell on wildcard error routes", () => {
    const { container } = render(<MiniApp route="/some/unknown/path" />);
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
    expect(screen.getByTestId("nf")).not.toBeNull();
  });
});
