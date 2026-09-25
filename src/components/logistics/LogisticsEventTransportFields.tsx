import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LogisticsEventLocation } from "@/features/logistics/events/useLogisticsEventLocation";

import { LogisticsEventPlaceField } from "./LogisticsEventPlaceField";

/** Optional end of a transport: the driver and vehicle stay blocked until then. */
export function TransportEndFields({
  crewTransfer,
  startDate,
  endDate,
  endTime,
  onEndDateChange,
  onEndTimeChange,
}: {
  crewTransfer: boolean;
  startDate: string;
  endDate: string;
  endTime: string;
  onEndDateChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="logistics-event-end-date">
        {crewTransfer ? "Vehículo ocupado hasta" : "Fin (opcional)"}
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          id="logistics-event-end-date"
          type="date"
          aria-label="Fecha de fin"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => onEndDateChange(e.target.value)}
        />
        <Input type="time" aria-label="Hora de fin" value={endTime} onChange={(e) => onEndTimeChange(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Si el transporte dura varios días, el conductor y el vehículo quedan bloqueados hasta entonces.
      </p>
    </div>
  );
}

/** Pick-up point, destination and passengers of a crew transfer (traslado de personal). */
export function CrewTransferFields({
  origin,
  destination,
  hasJob,
  passengerCount,
  onPassengerCountChange,
  jobCrewTotal,
}: {
  origin: LogisticsEventLocation;
  destination: LogisticsEventLocation;
  hasJob: boolean;
  passengerCount: number | null;
  onPassengerCountChange: (value: number | null) => void;
  /** People on the job who have not declined, when known. */
  jobCrewTotal: number | null;
}) {
  return (
    <>
      <LogisticsEventPlaceField
        id="crew-transfer-origin"
        location={origin}
        hasJob={hasJob}
        label="Punto de encuentro (origen)"
        placeholder="Nave, hotel, estación, aeropuerto…"
        help="Donde el conductor recoge al personal."
      />
      <LogisticsEventPlaceField
        id="crew-transfer-destination"
        location={destination}
        hasJob={hasJob}
        label={hasJob ? "Destino (si no es el recinto del trabajo)" : "Destino"}
        placeholder="Recinto, hotel, estación…"
      />
      <div className="space-y-2">
        <Label htmlFor="crew-transfer-passengers">Personas que viajan</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="crew-transfer-passengers"
            type="number"
            inputMode="numeric"
            min={1}
            max={80}
            className="w-24"
            value={passengerCount ?? ""}
            onChange={(e) => {
              const value = Number.parseInt(e.target.value, 10);
              onPassengerCountChange(Number.isFinite(value) && value > 0 ? Math.min(value, 80) : null);
            }}
            required
          />
          {jobCrewTotal !== null && jobCrewTotal > 0 && passengerCount !== jobCrewTotal && (
            <Button type="button" variant="outline" size="sm" onClick={() => onPassengerCountChange(Math.min(jobCrewTotal, 80))}>
              Todo el personal del trabajo ({jobCrewTotal})
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

/** "Crear también la vuelta": the return leg's own departure. */
export function CrewTransferReturnFields({
  enabled,
  onEnabledChange,
  returnDate,
  returnTime,
  minDate,
  onReturnDateChange,
  onReturnTimeChange,
}: {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  returnDate: string;
  returnTime: string;
  minDate: string;
  onReturnDateChange: (value: string) => void;
  onReturnTimeChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Checkbox id="alsoCreateReturn" checked={enabled} onCheckedChange={(v) => onEnabledChange(!!v)} />
        <Label htmlFor="alsoCreateReturn" className="text-sm">Crear también la vuelta</Label>
      </div>
      {enabled && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              aria-label="Fecha de la vuelta"
              value={returnDate}
              min={minDate || undefined}
              onChange={(e) => onReturnDateChange(e.target.value)}
              required
            />
            <Input
              type="time"
              aria-label="Hora de la vuelta"
              value={returnTime}
              onChange={(e) => onReturnTimeChange(e.target.value)}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Mismas personas y tipo de vehículo, con origen y destino invertidos. Conductor y vehículo se asignan en la matriz.
          </p>
        </>
      )}
    </div>
  );
}
