import { describe, it, expect, afterEach } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithRouter } from "./render-helpers";
import { SkipToContent } from "../SkipToContent";

describe("SkipToContent", () => {
  afterEach(() => cleanup());

  it("renders an anchor pointing to #main", () => {
    renderWithRouter(<SkipToContent />);
    const link = screen.getByRole("link", { name: /contenido|content/i });
    expect(link.getAttribute("href")).toBe("#main");
  });

  it("is hidden by default via sr-only utility", () => {
    renderWithRouter(<SkipToContent />);
    const link = screen.getByRole("link", { name: /contenido|content/i });
    expect(link.className).toContain("sr-only");
  });

  it("becomes visible on focus via focus-visible utility", () => {
    renderWithRouter(<SkipToContent />);
    const link = screen.getByRole("link", { name: /contenido|content/i });
    // Any of these utility fragments reveals the element on focus
    const reveals =
      link.className.includes("focus:not-sr-only") ||
      link.className.includes("focus-visible:not-sr-only") ||
      link.className.includes("focus:static");
    expect(reveals).toBe(true);
  });
});
