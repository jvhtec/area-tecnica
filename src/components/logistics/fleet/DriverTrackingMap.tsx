import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";

import { getErrorMessage } from "@/utils/errorMessage";
import {
  describeLocationAge,
  driverLocationName,
  isStaleLocation,
  type DriverLiveLocation,
} from "@/features/logistics/fleet/tracking";

type MapboxModule = typeof import("mapbox-gl")["default"];

type DriverTrackingMapProps = {
  token: string;
  locations: DriverLiveLocation[];
  nowIso: string;
  /** Driver to fly to; the panel sets it when a row's "Centrar" is pressed. */
  focusDriverId: string | null;
};

const MADRID: [number, number] = [-3.7038, 40.4168];

const escapeHtml = (text: string | null | undefined): string =>
  String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const truckMarker = (stale: boolean, heading: number | null) => {
  const element = document.createElement("div");
  element.setAttribute("role", "img");
  element.style.cssText = [
    "width:34px;height:34px;border-radius:50%;border:3px solid white",
    `background:${stale ? "#6b7280" : "#2563eb"}`,
    "box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center",
    "font-size:18px;cursor:pointer",
    heading !== null ? `transform:rotate(${Math.round(heading)}deg)` : "",
  ].join(";");
  element.textContent = heading !== null ? "➤" : "🚚";
  return element;
};

const destinationMarker = () => {
  const element = document.createElement("div");
  element.style.cssText = "font-size:22px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))";
  element.textContent = "📍";
  return element;
};

/**
 * Mapbox GL map with one marker per shared driver position (greyed once stale)
 * and a pin for the destination of the transport they are on. Loaded lazily,
 * like the other maps, so the maps chunk only ships when the tab is opened.
 */
export function DriverTrackingMap({ token, locations, nowIso, focusDriverId }: DriverTrackingMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapboxRef = useRef<MapboxModule | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<MapboxMarker[]>([]);
  const fittedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    let mounted = true;

    const init = async () => {
      try {
        const [{ default: mapboxgl }] = await Promise.all([import("mapbox-gl"), import("mapbox-gl/dist/mapbox-gl.css")]);
        if (!mounted || !container.current) return;
        mapboxRef.current = mapboxgl;
        mapboxgl.accessToken = token;
        const map = new mapboxgl.Map({
          container: container.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: MADRID,
          zoom: 5,
        });
        map.addControl(new mapboxgl.NavigationControl(), "top-right");
        map.addControl(new mapboxgl.FullscreenControl(), "top-right");
        map.on("load", () => {
          if (!mounted) return;
          setLoaded(true);
          map.resize();
        });
        map.on("error", (event) => {
          if (!mounted) return;
          console.error("Mapbox error:", event.error);
          setError("No se pudo cargar el mapa. Inténtalo de nuevo más tarde.");
        });
        mapRef.current = map;
      } catch (initError) {
        if (!mounted) return;
        setError(getErrorMessage(initError, "No se pudo cargar el mapa. Revisa tu conexión."));
      }
    };
    void init();

    return () => {
      mounted = false;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      mapboxRef.current = null;
    };
  }, [token]);

  // Redraw markers whenever positions change; fit the view only the first time.
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxRef.current;
    if (!loaded || !map || !mapboxgl) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const bounds = new mapboxgl.LngLatBounds();

    for (const location of locations) {
      const stale = isStaleLocation(location.recorded_at, nowIso);
      const name = driverLocationName(location);
      const transport = location.assignment
        ? `${escapeHtml(location.assignment.title ?? "Transporte")}${location.assignment.vehicle_name ? ` · ${escapeHtml(location.assignment.vehicle_name)}` : ""}`
        : "Sin transporte asociado";
      const popup = new mapboxgl.Popup({ offset: 20 }).setHTML(
        `<div style="padding:6px;min-width:180px;background:hsl(var(--popover));color:hsl(var(--popover-foreground))">
          <p style="font-weight:600;margin:0 0 4px">${escapeHtml(name)}</p>
          <p style="margin:0;font-size:12px">${transport}</p>
          <p style="margin:4px 0 0;font-size:12px;opacity:.8">${stale ? "Sin señal · " : ""}${escapeHtml(describeLocationAge(location.recorded_at, nowIso))}</p>
        </div>`,
      );
      const marker = new mapboxgl.Marker({ element: truckMarker(stale, location.heading_deg) })
        .setLngLat([location.longitude, location.latitude])
        .setPopup(popup)
        .addTo(map);
      marker.getElement().setAttribute("aria-label", `Posición de ${name}`);
      markersRef.current.push(marker);
      bounds.extend([location.longitude, location.latitude]);

      const destination = location.assignment;
      if (destination?.destination_lat !== null && destination?.destination_lat !== undefined && destination.destination_lng !== null) {
        const pin = new mapboxgl.Marker({ element: destinationMarker() })
          .setLngLat([destination.destination_lng, destination.destination_lat])
          .setPopup(new mapboxgl.Popup({ offset: 20 }).setText(`Destino de ${name}: ${destination.destination_name ?? ""}`))
          .addTo(map);
        markersRef.current.push(pin);
        bounds.extend([destination.destination_lng, destination.destination_lat]);
      }
    }

    if (!fittedRef.current && locations.length > 0) {
      fittedRef.current = true;
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 0 });
    }
  }, [loaded, locations, nowIso]);

  useEffect(() => {
    const map = mapRef.current;
    if (!loaded || !map || !focusDriverId) return;
    const target = locations.find((location) => location.driver_id === focusDriverId);
    if (target) map.flyTo({ center: [target.longitude, target.latitude], zoom: 14 });
  }, [loaded, focusDriverId, locations]);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-md border sm:h-[520px]">
      <div ref={container} className="h-full w-full" aria-label="Mapa de conductores" />
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4 text-center text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
