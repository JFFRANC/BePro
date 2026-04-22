import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";

interface RenderWithRouterOptions extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  routes?: string[];
}

// jsdom doesn't implement matchMedia. Install a minimal shim the first time
// renderWithRouter is called so any descendant that probes system preference
// (e.g. next-themes when `enableSystem` is on) does not throw.
function ensureMatchMediaShim(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (window as any).matchMedia === "function") return;
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

export function renderWithRouter(
  ui: ReactElement,
  { route = "/", routes, ...options }: RenderWithRouterOptions = {},
): RenderResult {
  ensureMatchMediaShim();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="bepro.theme"
    >
      <MemoryRouter initialEntries={routes ?? [route]}>
        <TooltipProvider>{children}</TooltipProvider>
      </MemoryRouter>
    </NextThemesProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}
