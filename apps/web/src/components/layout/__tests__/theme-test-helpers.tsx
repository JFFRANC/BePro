import type { ReactElement, ReactNode } from "react";
import {
  render,
  type RenderOptions,
  type RenderResult,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

interface MatchMediaListener {
  (event: MediaQueryListEvent): void;
}

interface MatchMediaState {
  systemIsDark: boolean;
  listeners: Set<MatchMediaListener>;
}

declare global {
  // Persist state across a single test's lifecycle so we can dispatch changes.
  // eslint-disable-next-line no-var
  var __themeMatchMediaState: MatchMediaState | undefined;
}

export function installMatchMediaMock({
  systemIsDark,
}: {
  systemIsDark: boolean;
}): MatchMediaState {
  const state: MatchMediaState = { systemIsDark, listeners: new Set() };
  globalThis.__themeMatchMediaState = state;

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => {
      const isDarkQuery = query.includes("prefers-color-scheme: dark");
      return {
        matches: isDarkQuery ? state.systemIsDark : !state.systemIsDark,
        media: query,
        onchange: null,
        addEventListener: (evt: string, cb: MatchMediaListener) => {
          if (evt === "change" && isDarkQuery) state.listeners.add(cb);
        },
        removeEventListener: (evt: string, cb: MatchMediaListener) => {
          if (evt === "change") state.listeners.delete(cb);
        },
        addListener: (cb: MatchMediaListener) => {
          if (isDarkQuery) state.listeners.add(cb);
        },
        removeListener: (cb: MatchMediaListener) => state.listeners.delete(cb),
        dispatchEvent: vi.fn(),
      };
    }),
  });

  return state;
}

export function dispatchSystemThemeChange(systemIsDark: boolean): void {
  const state = globalThis.__themeMatchMediaState;
  if (!state) return;
  state.systemIsDark = systemIsDark;
  const event = { matches: systemIsDark } as unknown as MediaQueryListEvent;
  for (const listener of state.listeners) listener(event);
}

export function cleanupMatchMediaMock(): void {
  globalThis.__themeMatchMediaState = undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).matchMedia;
}

interface RenderWithThemeOptions extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  defaultMode?: "light" | "dark" | "system";
  /**
   * Override matchMedia mock before mount. If undefined, callers are expected
   * to call installMatchMediaMock themselves.
   */
  systemIsDark?: boolean;
}

export function renderWithTheme(
  ui: ReactElement,
  {
    route = "/",
    defaultMode = "system",
    systemIsDark,
    ...options
  }: RenderWithThemeOptions = {},
): RenderResult {
  if (systemIsDark !== undefined) installMatchMediaMock({ systemIsDark });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultMode}
      enableSystem
      storageKey="bepro.theme"
    >
      <MemoryRouter initialEntries={[route]}>
        <TooltipProvider>{children}</TooltipProvider>
      </MemoryRouter>
    </NextThemesProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}

export function clearThemeStorage(): void {
  try {
    localStorage.removeItem("bepro.theme");
  } catch {
    /* ignore */
  }
  document.documentElement.classList.remove("dark", "light");
}
