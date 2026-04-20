export type TelemetryEvent =
  | {
      name: "nav.click";
      payload: { itemId: string; path: string; source: "sidebar" | "mobile" | "shortcut" };
    }
  | { name: "sidebar.toggle"; payload: { collapsed: boolean } }
  | { name: "mobile-drawer.open"; payload: Record<string, never> }
  | {
      name: "mobile-drawer.close";
      payload: { reason: "nav" | "backdrop" | "escape" | "close-button" };
    }
  | { name: "theme.change"; payload: { value: "light" | "dark" | "system" } }
  | { name: "shortcut.use"; payload: { key: string } };

// Dispatcher no-op para v1. Una feature posterior reemplazará el cuerpo sin tocar los call sites.
export function emit(event: TelemetryEvent): void {
  try {
    if (import.meta.env.DEV) {
      console.debug("[telemetry]", event.name, event.payload);
    }
  } catch {
    // defensive: never throw from telemetry
  }
}
