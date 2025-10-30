declare namespace google {
  namespace maps {
    class Map {
      constructor(element: HTMLElement, opts?: MapOptions);
      fitBounds(bounds: LatLngBounds): void;
      setCenter(latLng: LatLng | LatLngLiteral): void;
      setZoom(zoom: number): void;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
      addListener(event: string, handler: Function): void;
    }

    class InfoWindow {
      constructor(opts?: InfoWindowOptions);
      open(map: Map, marker: Marker): void;
      close(): void;
    }

    class Polyline {
      constructor(opts?: PolylineOptions);
      setMap(map: Map | null): void;
    }

    class LatLngBounds {
      constructor();
      extend(point: LatLng | LatLngLiteral): LatLngBounds;
      isEmpty(): boolean;
    }

    class LatLng {
      constructor(lat: number, lng: number);
      lat(): number;
      lng(): number;
    }

    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    interface MapOptions {
      zoom?: number;
      center?: LatLng | LatLngLiteral;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
    }

    interface MarkerOptions {
      position?: LatLng | LatLngLiteral;
      map?: Map;
      title?: string;
      icon?: any;
      label?: any;
    }

    interface InfoWindowOptions {
      content?: string | HTMLElement;
    }

    interface PolylineOptions {
      path?: (LatLng | LatLngLiteral)[];
      geodesic?: boolean;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      map?: Map;
    }

    enum SymbolPath {
      CIRCLE = 0,
      FORWARD_CLOSED_ARROW = 1,
      FORWARD_OPEN_ARROW = 2,
      BACKWARD_CLOSED_ARROW = 3,
      BACKWARD_OPEN_ARROW = 4,
    }
  }
}

interface Window {
  google: typeof google;
}
