import { lazy, Suspense } from "react";
import type { LocationMapProps } from "./LocationMap.impl";

// Lazy split: maplibre-gl + react-map-gl pesan ~283 KB gzipped y solo se
// cargan al entrar a /clients/:id o al editar un cliente. Mantenerlos fuera
// del entry chunk recupera el presupuesto de bundle (SC-005).
const LazyImpl = lazy(() =>
  import("./LocationMap.impl").then((m) => ({ default: m.LocationMap })),
);

function LocationMapFallback() {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <div className="h-[68px] rounded-md bg-muted/40 animate-pulse" />
      <div
        className="rounded-lg border bg-muted/40 animate-pulse"
        style={{ height: 300 }}
      />
    </div>
  );
}

export function LocationMap(props: LocationMapProps) {
  return (
    <Suspense fallback={<LocationMapFallback />}>
      <LazyImpl {...props} />
    </Suspense>
  );
}

export type { LocationMapProps };
