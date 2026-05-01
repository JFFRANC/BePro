// 012-client-detail-ux / US2 — CopyAddressButton tests.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Toaster, toast } from "sonner";
import { CopyAddressButton } from "../CopyAddressButton";

// Sonner needs a Toaster mounted to render toasts in the DOM.
function withToaster(node: React.ReactNode) {
  return (
    <>
      {node}
      <Toaster richColors />
    </>
  );
}

describe("CopyAddressButton", () => {
  let writeTextSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      value: {
        clipboard: {
          writeText: writeTextSpy,
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    toast.dismiss();
  });

  it("does not render when address is empty", () => {
    const { container } = render(<CopyAddressButton address={""} />);
    expect(container.innerHTML).toBe("");
  });

  it("does not render when address is null", () => {
    const { container } = render(<CopyAddressButton address={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("writes the whitespace-normalized address to navigator.clipboard", async () => {
    render(withToaster(<CopyAddressButton address={"  Av.  Reforma   123  " } />));
    fireEvent.click(screen.getByRole("button", { name: /copiar ubicación/i }));
    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith("Av. Reforma 123");
    });
  });

  it("falls back to the manual-copy toast when clipboard API is unavailable", async () => {
    // Simulate a non-secure context: no clipboard.
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });
    render(withToaster(<CopyAddressButton address={"Calle Sin Nombre 1"} />));
    fireEvent.click(screen.getByRole("button", { name: /copiar ubicación/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/copia manual: calle sin nombre 1/i),
      ).toBeTruthy();
    });
  });
});
