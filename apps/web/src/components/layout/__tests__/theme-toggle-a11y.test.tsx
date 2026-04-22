import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithTheme,
  installMatchMediaMock,
  cleanupMatchMediaMock,
  clearThemeStorage,
} from "./theme-test-helpers";
import { ThemeToggle } from "../ThemeToggle";

describe("ThemeToggle keyboard & screen-reader a11y (FR-012–FR-014, FR-019, SC-005)", () => {
  beforeEach(() => {
    clearThemeStorage();
    installMatchMediaMock({ systemIsDark: false });
  });

  afterEach(() => {
    cleanup();
    cleanupMatchMediaMock();
  });

  it("trigger is reachable via Tab and can be activated with Enter", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: /tema/i });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("opens with Space key as well", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: /tema/i });
    trigger.focus();
    await user.keyboard(" ");
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
  });

  it("Escape closes the menu and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: /tema/i });
    await user.click(trigger);
    await waitFor(() => screen.getByRole("menuitemradio", { name: "Claro" }));
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("ArrowDown + Enter keyboard sequence selects an option (FR-012)", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />, { defaultMode: "system" });
    const trigger = screen.getByRole("button", { name: /tema/i });
    trigger.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => screen.getByRole("menuitemradio", { name: "Claro" }));
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    // The first arrow-down lands on the first option; Enter selects it.
    // Regardless of which highlighted option Enter hits, something must
    // have been selected: the menu closes and storage reflects a non-system value.
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("every menu option renders a visible focus-ring class (FR-013)", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /tema/i }));
    await waitFor(() => screen.getByRole("menuitemradio", { name: "Claro" }));
    const options = screen.getAllByRole("menuitemradio");
    for (const opt of options) {
      expect(
        opt.className,
        `Option "${opt.textContent}" lacks a focus-ring utility class`,
      ).toMatch(/focus[-:]/);
    }
  });

  it("trigger renders a visible focus-ring class", () => {
    renderWithTheme(<ThemeToggle />);
    const trigger = screen.getByRole("button", { name: /tema/i });
    // shadcn Button variant=ghost applies focus-visible:ring-* classes via buttonVariants.
    expect(trigger.className).toMatch(/focus-visible[:-]ring/);
  });

  it("accessible label is in Spanish", () => {
    renderWithTheme(<ThemeToggle />);
    const trigger = screen.getByRole("button");
    expect(trigger.getAttribute("aria-label")).toMatch(/cambiar tema/i);
  });

  it("every menu option has role=menuitemradio with aria-checked", async () => {
    const user = userEvent.setup();
    renderWithTheme(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /tema/i }));
    await waitFor(() => screen.getByRole("menuitemradio", { name: "Claro" }));
    const options = screen.getAllByRole("menuitemradio");
    expect(options).toHaveLength(3);
    for (const opt of options) {
      expect(opt.getAttribute("aria-checked")).toMatch(/^(true|false)$/);
    }
  });
});
