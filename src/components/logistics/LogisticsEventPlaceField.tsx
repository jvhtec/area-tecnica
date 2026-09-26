import { PlaceAutocomplete } from "@/components/maps/PlaceAutocomplete";

import type { LogisticsEventLocation } from "@/features/logistics/events/useLogisticsEventLocation";

type LogisticsEventPlaceFieldProps = {
  location: LogisticsEventLocation;
  hasJob: boolean;
  /** Overrides for the crew-transfer pick-up and destination fields. */
  label?: string;
  placeholder?: string;
  help?: string;
  id?: string;
};

/** Place picker for a logistics event: only needed when it is not (just) the job venue. */
export function LogisticsEventPlaceField({ location, hasJob, label, placeholder, help, id }: LogisticsEventPlaceFieldProps) {
  return (
    <div className="space-y-2">
      <PlaceAutocomplete
        id={id}
        value={location.input}
        label={label ?? (hasJob ? "Lugar (si no es el recinto del trabajo)" : "Lugar")}
        placeholder={placeholder ?? "Proveedor, nave, punto de recogida…"}
        onInputChange={location.onInputChange}
        onSelect={location.onSelect}
      />
      <p className="text-xs text-muted-foreground">
        {help ?? "Los conductores navegan hasta aquí desde su panel. Sin lugar propio se usa el recinto del trabajo."}
      </p>
    </div>
  );
}
