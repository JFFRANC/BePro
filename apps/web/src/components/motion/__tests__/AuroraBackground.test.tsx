import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AuroraBackground } from "../AuroraBackground";

// Contract tests — AuroraBackground is purely presentational.
// We assert structure, accessibility (decorative), and that motion is gated
// behind motion-safe so prefers-reduced-motion users get a static layer.
describe("AuroraBackground", () => {
  it("renders the layer with aria-hidden=true (decorative)", () => {
    const { container } = render(<AuroraBackground />);
    const layer = container.querySelector('[data-testid="aurora-background"]');
    expect(layer).toBeTruthy();
    expect(layer?.getAttribute("aria-hidden")).toBe("true");
  });

  it("paints four floating blobs", () => {
    const { container } = render(<AuroraBackground />);
    const blobs = container.querySelectorAll("[data-aurora-blob]");
    expect(blobs.length).toBe(4);
  });

  it("includes a subtle dotted grid + vignette overlay", () => {
    const { container } = render(<AuroraBackground />);
    expect(container.querySelector("[data-aurora-grid]")).toBeTruthy();
    expect(container.querySelector("[data-aurora-vignette]")).toBeTruthy();
  });

  it("gates blob drift behind motion-safe (reduced-motion users get static layer)", () => {
    const { container } = render(<AuroraBackground />);
    const blobs = container.querySelectorAll("[data-aurora-blob]");
    blobs.forEach((blob) => {
      expect(blob.className).toMatch(/motion-safe:animate-/);
    });
  });

  it("is fixed-position and sits behind the content (-z-10)", () => {
    const { container } = render(<AuroraBackground />);
    const layer = container.querySelector('[data-testid="aurora-background"]');
    expect(layer?.className).toMatch(/fixed/);
    expect(layer?.className).toMatch(/-z-10/);
    expect(layer?.className).toMatch(/pointer-events-none/);
  });
});
