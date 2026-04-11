import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ThemeProvider, type TenantTheme } from "@/components/theme-provider";

afterEach(() => {
  cleanup();
  const root = document.documentElement;
  root.style.cssText = "";
});

describe("ThemeProvider — Multi-tenant Runtime Injection", () => {
  it("T051: injects CSS variables when tenant theme is provided", () => {
    const theme: TenantTheme = {
      primary: "oklch(0.6 0.15 260)",
      radius: "0.75rem",
    };

    render(
      <ThemeProvider theme={theme}>
        <div>App</div>
      </ThemeProvider>,
    );

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--primary")).toBe(
      "oklch(0.6 0.15 260)",
    );
    expect(root.style.getPropertyValue("--radius")).toBe("0.75rem");
  });

  it("T052: does NOT inject CSS variables when theme is null", () => {
    render(
      <ThemeProvider theme={null}>
        <div>App</div>
      </ThemeProvider>,
    );

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.style.getPropertyValue("--radius")).toBe("");
  });

  it("T053: cleans up injected CSS variables on unmount", () => {
    const theme: TenantTheme = {
      primary: "oklch(0.6 0.15 260)",
      fontHeading: "'Poppins', sans-serif",
    };

    const { unmount } = render(
      <ThemeProvider theme={theme}>
        <div>App</div>
      </ThemeProvider>,
    );

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--primary")).toBe(
      "oklch(0.6 0.15 260)",
    );

    unmount();

    expect(root.style.getPropertyValue("--primary")).toBe("");
    expect(root.style.getPropertyValue("--font-heading")).toBe("");
  });

  it("T054: handles partial theme — only specified properties are injected", () => {
    const theme: TenantTheme = {
      primary: "oklch(0.5 0.2 300)",
    };

    render(
      <ThemeProvider theme={theme}>
        <div>App</div>
      </ThemeProvider>,
    );

    const root = document.documentElement;
    expect(root.style.getPropertyValue("--primary")).toBe(
      "oklch(0.5 0.2 300)",
    );
    expect(root.style.getPropertyValue("--secondary")).toBe("");
    expect(root.style.getPropertyValue("--accent")).toBe("");
    expect(root.style.getPropertyValue("--radius")).toBe("");
  });
});
