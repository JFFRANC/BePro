import { useState, useCallback, useEffect, useRef } from "react";
import Map, { Marker, NavigationControl, type MapRef } from "react-map-gl/maplibre";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebouncedValue } from "@/lib/use-debounce";
import { toast } from "sonner";
import "maplibre-gl/dist/maplibre-gl.css";

const MEXICO_CENTER = { latitude: 19.4326, longitude: -99.1332 };

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    "osm-tiles": {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "osm-tiles",
      type: "raster" as const,
      source: "osm-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const GOOGLE_MAPS_HOSTS = [
  "share.google",
  "maps.google.com",
  "www.google.com",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
];

function isGoogleMapsUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return GOOGLE_MAPS_HOSTS.some(
      (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

interface LocationMapProps {
  latitude?: number;
  longitude?: number;
  address?: string;
  onChange?: (data: { latitude: number; longitude: number; address?: string }) => void;
  readOnly?: boolean;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export function LocationMap({
  latitude,
  longitude,
  address,
  onChange,
  readOnly = false,
}: LocationMapProps) {
  const [searchQuery, setSearchQuery] = useState(address ?? "");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debouncedQuery = useDebouncedValue(searchQuery, 500);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);

  const centerLat = latitude ?? MEXICO_CENTER.latitude;
  const centerLng = longitude ?? MEXICO_CENTER.longitude;
  const hasLocation = latitude !== undefined && longitude !== undefined;

  // Centrar mapa cuando las coordenadas cambian desde fuera (ej: selección de sugerencia, URL resuelta)
  const prevCoordsRef = useRef(`${latitude},${longitude}`);
  useEffect(() => {
    const key = `${latitude},${longitude}`;
    if (key !== prevCoordsRef.current && latitude !== undefined && longitude !== undefined) {
      prevCoordsRef.current = key;
      mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 16, duration: 1000 });
    }
  }, [latitude, longitude]);

  const resolveGoogleMapsUrl = useCallback(async (url: string) => {
    setResolving(true);
    setSuggestions([]);
    setShowSuggestions(false);
    try {
      const res = await fetch(`/api/utils/resolve-map-url?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo resolver la URL");
        return;
      }
      const resolvedAddress = data.address ?? url.trim();
      if (data.address) setSearchQuery(data.address);
      onChange?.({ latitude: data.latitude, longitude: data.longitude, address: resolvedAddress });
      toast.success("Ubicación cargada desde Google Maps");
    } catch {
      toast.error("Error al resolver la URL de Google Maps");
    } finally {
      setResolving(false);
    }
  }, [onChange]);

  const searchAddress = useCallback(async (query: string) => {
    if (!query || query.length < 3 || isGoogleMapsUrl(query)) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=mx&limit=5&accept-language=es`,
        { headers: { "User-Agent": "BePro/1.0" } },
      );
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (!debouncedQuery || readOnly) return;
    if (isGoogleMapsUrl(debouncedQuery)) {
      resolveGoogleMapsUrl(debouncedQuery);
    } else {
      searchAddress(debouncedQuery);
    }
  }, [debouncedQuery, readOnly, searchAddress, resolveGoogleMapsUrl]);

  const handleSelectSuggestion = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setSearchQuery(result.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange?.({ latitude: lat, longitude: lng, address: result.display_name });
  };

  const handleMarkerDrag = useCallback(
    (e: { lngLat: { lat: number; lng: number } }) => {
      onChange?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="relative">
          <Label htmlFor="address-search" className="mb-1">
            Buscar dirección o pegar URL de Google Maps
          </Label>
          <Input
            id="address-search"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length < 3) {
                setSuggestions([]);
                setShowSuggestions(false);
              }
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Escribe una dirección o pega un link de Google Maps..."
            disabled={resolving}
          />
          {resolving && (
            <p className="text-xs text-muted-foreground mt-1">Resolviendo ubicación...</p>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
            >
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                  onMouseDown={() => handleSelectSuggestion(s)}
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg overflow-hidden border" style={{ height: 300 }}>
        <Map
          key={`${centerLat}-${centerLng}`}
          ref={mapRef}
          initialViewState={{
            latitude: centerLat,
            longitude: centerLng,
            zoom: hasLocation ? 15 : 5,
          }}
          mapStyle={OSM_STYLE}
        >
          <NavigationControl position="top-right" />
          {hasLocation && (
            <Marker
              latitude={centerLat}
              longitude={centerLng}
              draggable={!readOnly}
              onDragEnd={handleMarkerDrag}
            />
          )}
        </Map>
      </div>

      {hasLocation && (
        <p className="text-xs text-muted-foreground">
          Lat: {centerLat.toFixed(6)}, Lng: {centerLng.toFixed(6)}
          {!readOnly && " — Arrastra el marcador para ajustar la ubicación"}
        </p>
      )}
    </div>
  );
}
