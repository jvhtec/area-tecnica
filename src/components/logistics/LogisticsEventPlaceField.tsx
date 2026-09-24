import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";

import type { LogisticsEventLocation } from "@/features/logistics/events/useLogisticsEventLocation";

/** Place picker for a logistics event: only needed when it is not (just) the job venue. */
export function LogisticsEventPlaceField({ location, hasJob }: { location: LogisticsEventLocation; hasJob: boolean }) {
  return (
    <div className="space-y-2">
      <PlaceAutocomplete
        value={location.input}
        label={hasJob ? "Lugar (si no es el recinto del trabajo)" : "Lugar"}
        placeholder="Proveedor, nave, punto de recogida…"
        onInputChange={location.onInputChange}
        onSelect={location.onSelect}
      />
      <p className="text-xs text-muted-foreground">
        Los conductores navegan hasta aquí desde su panel. Sin lugar propio se usa el recinto del trabajo.
      </p>
    </div>
  );
}
