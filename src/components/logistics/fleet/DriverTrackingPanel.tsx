import { useEffect, useState } from "react";
import { Crosshair, Loader2, MapPinOff, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getMapboxToken } from "@/lib/mapbox/mapboxClient";
import { formatTransportTime } from "@/features/logistics/fleet/fleetModel";
import {
  STALE_AFTER_MINUTES,
  describeLocationAge,
  driverLocationName,
  isStaleLocation,
} from "@/features/logistics/fleet/tracking";
import { useDriverLocations } from "@/features/logistics/fleet/useLogisticsFleet";
import { getErrorMessage } from "@/utils/errorMessage";

import { DriverTrackingMap } from "./DriverTrackingMap";

/**
 * "Seguimiento": where the drivers who share their position are right now.
 * The list works without the map (no Mapbox token, no WebGL); the map is a
 * bonus on top of it.
 */
export function DriverTrackingPanel() {
  const { data, isLoading, error, dataUpdatedAt } = useDriverLocations();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [focusDriverId, setFocusDriverId] = useState<string | null>(null);
  // Re-evaluated per render (each poll/realtime update rerenders) so ages tick along.
  const nowIso = new Date().toISOString();

  useEffect(() => {
    let mounted = true;
    getMapboxToken()
      .then((value) => { if (mounted) setToken(value); })
      .catch(() => { if (mounted) setToken(null); });
    return () => { mounted = false; };
  }, []);

  const locations = data ?? [];
  const live = locations.filter((location) => !isStaleLocation(location.recorded_at, nowIso)).length;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{live} en directo</Badge>
          {locations.length - live > 0 && <Badge variant="outline" className="text-muted-foreground">{locations.length - live} sin señal</Badge>}
          {dataUpdatedAt > 0 && <span>Actualizado {describeLocationAge(new Date(dataUpdatedAt).toISOString(), nowIso)}</span>}
        </div>
        {token === undefined ? (
          <Card><CardContent className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
        ) : token ? (
          <DriverTrackingMap token={token} locations={locations} nowIso={nowIso} focusDriverId={focusDriverId} />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              El mapa no está disponible ahora mismo. La lista de conductores sigue actualizándose.
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Conductores</CardTitle>
          <CardDescription>
            Solo quienes activan «Compartir mi ubicación» en su panel, y solo con un transporte en marcha. Una posición sin
            actualizar en {STALE_AFTER_MINUTES} min aparece como sin señal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
          ) : isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : locations.length === 0 ? (
            <div className="space-y-2 py-6 text-center text-sm text-muted-foreground">
              <MapPinOff className="mx-auto h-6 w-6" />
              <p>Ningún conductor está compartiendo su ubicación.</p>
            </div>
          ) : (
            <ul className="divide-y" aria-label="Conductores compartiendo ubicación">
              {locations.map((location) => {
                const stale = isStaleLocation(location.recorded_at, nowIso);
                const name = driverLocationName(location);
                const assignment = location.assignment;
                return (
                  <li key={location.driver_id} className={cn("flex flex-wrap items-center justify-between gap-2 py-2 text-sm", stale && "opacity-70")}>
                    <div className="min-w-0">
                      <p className="font-medium">{name}</p>
                      <p className="text-muted-foreground">
                        {assignment
                          ? `${assignment.title ?? "Transporte"} · ${formatTransportTime(assignment.starts_at, assignment.timezone)}–${formatTransportTime(assignment.ends_at, assignment.timezone)}${assignment.vehicle_name ? ` · ${assignment.vehicle_name}` : ""}`
                          : "Sin transporte asociado"}
                      </p>
                      <p className={stale ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
                        {stale ? "Sin señal · " : ""}{describeLocationAge(location.recorded_at, nowIso)}
                        {location.speed_mps !== null && !stale ? ` · ${Math.round(location.speed_mps * 3.6)} km/h` : ""}
                      </p>
                    </div>
                    {token && (
                      <Button size="sm" variant="outline" aria-label={`Centrar el mapa en ${name}`} onClick={() => setFocusDriverId(location.driver_id)}>
                        <Crosshair className="mr-1 h-4 w-4" /> Centrar
                      </Button>
                    )}
                    {!token && <Truck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
