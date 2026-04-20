declare module "react-map-gl/maplibre" {
  import type * as React from "react";

  export interface MapRef {
    flyTo: (options: { center: [number, number]; zoom: number; duration: number }) => void;
  }

  export interface MapProps {
    initialViewState: { latitude: number; longitude: number; zoom: number };
    mapStyle: unknown;
    children?: React.ReactNode;
  }

  export interface MarkerProps {
    latitude: number;
    longitude: number;
    draggable?: boolean;
    onDragEnd?: (event: { lngLat: { lat: number; lng: number } }) => void;
  }

  export interface NavigationControlProps {
    position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  }

  const Map: React.ForwardRefExoticComponent<MapProps & React.RefAttributes<MapRef>>;
  export const Marker: React.FC<MarkerProps>;
  export const NavigationControl: React.FC<NavigationControlProps>;
  export default Map;
}
