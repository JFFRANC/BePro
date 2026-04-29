// Helper de test: reemplaza window.matchMedia con una implementacion determinista
// que permite controlar prefers-reduced-motion y prefers-color-scheme en jsdom.

export interface MatchMediaState {
  prefersReducedMotion: boolean;
  prefersColorScheme: "light" | "dark";
}

interface InstalledMatchMedia {
  reset(): void;
  set(state: Partial<MatchMediaState>): void;
  state(): MatchMediaState;
}

const DEFAULT_STATE: MatchMediaState = {
  prefersReducedMotion: false,
  prefersColorScheme: "light",
};

// Instala un mock de matchMedia en window. Devuelve helpers para mutar el estado
// durante cada test y para resetear entre tests.
export function installMatchMediaMock(
  initial: Partial<MatchMediaState> = {},
): InstalledMatchMedia {
  const currentState: MatchMediaState = { ...DEFAULT_STATE, ...initial };
  const listeners = new Set<(ev: MediaQueryListEvent) => void>();

  const matches = (query: string): boolean => {
    const q = query.toLowerCase();
    if (q.includes("prefers-reduced-motion: reduce")) {
      return currentState.prefersReducedMotion;
    }
    if (q.includes("prefers-reduced-motion: no-preference")) {
      return !currentState.prefersReducedMotion;
    }
    if (q.includes("prefers-color-scheme: dark")) {
      return currentState.prefersColorScheme === "dark";
    }
    if (q.includes("prefers-color-scheme: light")) {
      return currentState.prefersColorScheme === "light";
    }
    return false;
  };

  const fakeMatchMedia = (query: string): MediaQueryList => {
    const list: MediaQueryList = {
      matches: matches(query),
      media: query,
      onchange: null,
      addListener: (cb) => {
        if (cb) listeners.add(cb as (ev: MediaQueryListEvent) => void);
      },
      removeListener: (cb) => {
        if (cb) listeners.delete(cb as (ev: MediaQueryListEvent) => void);
      },
      addEventListener: (_type: string, cb: EventListenerOrEventListenerObject | null) => {
        if (cb) listeners.add(cb as (ev: MediaQueryListEvent) => void);
      },
      removeEventListener: (_type: string, cb: EventListenerOrEventListenerObject | null) => {
        if (cb) listeners.delete(cb as (ev: MediaQueryListEvent) => void);
      },
      dispatchEvent: () => true,
    };
    return list;
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: fakeMatchMedia,
  });

  return {
    reset() {
      Object.assign(currentState, DEFAULT_STATE);
      listeners.clear();
    },
    set(next: Partial<MatchMediaState>) {
      Object.assign(currentState, next);
      // Simula un evento de cambio para todos los listeners registrados.
      for (const cb of listeners) {
        cb({ matches: false, media: "" } as MediaQueryListEvent);
      }
    },
    state() {
      return { ...currentState };
    },
  };
}
