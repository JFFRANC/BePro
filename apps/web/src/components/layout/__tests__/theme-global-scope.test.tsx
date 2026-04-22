import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  installMatchMediaMock,
  cleanupMatchMediaMock,
  clearThemeStorage,
} from "./theme-test-helpers";

function MiniAppAt(route: string) {
  return render(
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="bepro.theme"
    >
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<div data-testid="login">LOGIN</div>} />
          <Route
            path="/change-password"
            element={<div data-testid="cp">CP</div>}
          />
          <Route path="/" element={<div data-testid="home">HOME</div>} />
        </Routes>
      </MemoryRouter>
    </NextThemesProvider>,
  );
}

describe("theme applies to unauthenticated / non-shell routes (FR-018)", () => {
  beforeEach(() => {
    clearThemeStorage();
    installMatchMediaMock({ systemIsDark: false });
  });

  afterEach(() => {
    cleanup();
    cleanupMatchMediaMock();
  });

  it("dark mode applies to /login (outside shell)", async () => {
    localStorage.setItem("bepro.theme", "dark");
    MiniAppAt("/login");
    expect(screen.getByTestId("login")).not.toBeNull();
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("dark mode applies to /change-password (outside shell)", async () => {
    localStorage.setItem("bepro.theme", "dark");
    MiniAppAt("/change-password");
    expect(screen.getByTestId("cp")).not.toBeNull();
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("light mode applies on /login even if OS is dark (explicit wins)", async () => {
    cleanupMatchMediaMock();
    installMatchMediaMock({ systemIsDark: true });
    localStorage.setItem("bepro.theme", "light");
    MiniAppAt("/login");
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
