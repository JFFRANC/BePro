import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ErrorBoundary } from "@/components/error-boundary";

function BrokenComponent(): React.ReactNode {
  throw new Error("Test crash");
}

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <p>Working</p>
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText("Working")).toBeDefined();
  });

  it("catches render errors and shows error page", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <BrokenComponent />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText("Error del servidor")).toBeDefined();
    spy.mockRestore();
  });
});
