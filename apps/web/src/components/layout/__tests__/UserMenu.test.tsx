// 008-ux-roles-refinements / US1 — Header user menu smoke tests.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";
import { UserMenu } from "../UserMenu";

const logoutMock = vi.fn();
type Role =
  | "recruiter"
  | "admin"
  | "manager"
  | "account_executive";
let userOverride: {
  firstName?: string;
  lastName?: string;
  email: string;
  role: Role;
} | null = null;

vi.mock("@/modules/auth/hooks/useAuth", () => ({
  useAuth: () => ({
    user: userOverride,
    isAuthenticated: Boolean(userOverride),
    isLoading: false,
    login: vi.fn(),
    logout: logoutMock,
  }),
}));

function wrap(children: ReactNode, initialEntries: string[] = ["/"]) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={children} />
        <Route path="/login" element={<div data-testid="login-page">login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("UserMenu (US1)", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    logoutMock.mockResolvedValue(undefined);
    userOverride = null;
  });

  afterEach(() => cleanup());

  it("renders the user's full name + role when firstName/lastName are set", () => {
    userOverride = {
      firstName: "Laura",
      lastName: "Rivera",
      email: "laura@bepro.mx",
      role: "recruiter",
    };
    render(wrap(<UserMenu />));
    expect(screen.getByRole("button", { name: /abrir menú de usuario/i })).toBeTruthy();
    // The avatar fallback shows initials "LR".
    expect(screen.getByText("LR")).toBeTruthy();
    // Display name and Spanish role label appear in the trigger area.
    expect(screen.getAllByText(/laura rivera/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/reclutador/i)).toBeTruthy();
  });

  it("falls back to email when there is no display name", () => {
    userOverride = {
      firstName: undefined,
      lastName: undefined,
      email: "x@bepro.mx",
      role: "admin",
    };
    render(wrap(<UserMenu />));
    expect(screen.getAllByText(/x@bepro\.mx/i).length).toBeGreaterThanOrEqual(1);
    // First character of email becomes the avatar fallback.
    expect(screen.getByText("X")).toBeTruthy();
  });

  it("renders null when there is no user", () => {
    userOverride = null;
    const { container } = render(wrap(<UserMenu />));
    expect(container.querySelector("[aria-label*='menú de usuario']")).toBeNull();
  });

  it("opens the menu (aria-expanded flips to true) when the trigger is clicked", async () => {
    userOverride = {
      firstName: "Ana",
      lastName: "López",
      email: "ana@bepro.mx",
      role: "manager",
    };
    const user = userEvent.setup();
    render(wrap(<UserMenu />));
    const trigger = screen.getByRole("button", { name: /abrir menú de usuario/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger);
    await waitFor(() =>
      expect(trigger.getAttribute("aria-expanded")).toBe("true"),
    );
    // Full click-to-logout-to-redirect flow (through @base-ui portal) is
    // covered by the Playwright E2E suite; jsdom cannot flush the popup
    // actions reliably enough to assert here.
  });
});
