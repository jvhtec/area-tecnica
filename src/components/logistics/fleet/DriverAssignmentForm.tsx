import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  saveDriverAssignment,
  type AssignmentConflict,
} from "@/features/logistics/fleet/fleetApi";
import {
  DRIVER_WARNING_LABELS,
  defaultAssignmentWindow,
  driverDisplayName,
  driverVehicleWarnings,
  formatTransportTime,
  transportEventTitle,
  vehicleLabel,
  vehicleTypeLabel,
  type DriverAssignment,
  type LogisticsMatrixData,
  type MatrixTransportEvent,
} from "@/features/logistics/fleet/fleetModel";
import { getErrorMessage } from "@/utils/errorMessage";
import { localInputToUTC, utcToLocalInput } from "@/utils/timezoneUtils";

const NONE = "none";

export type DriverAssignmentFormProps = {
  event: MatrixTransportEvent;
  data: LogisticsMatrixData;
  /** The row the dialog was opened from, used to prefill a new assignment. */
  defaultDriverId?: string | null;
  defaultVehicleId?: string | null;
  existing?: DriverAssignment | null;
  onSaved: () => void;
  onCancel: () => void;
};

export function DriverAssignmentForm({
  event,
  data,
  defaultDriverId,
  defaultVehicleId,
  existing,
  onSaved,
  onCancel,
}: DriverAssignmentFormProps) {
  const { toast } = useToast();
  const initialWindow = existing
    ? {
        start: utcToLocalInput(existing.starts_at, event.timezone),
        end: utcToLocalInput(existing.ends_at, event.timezone),
      }
    : defaultAssignmentWindow(event);
  const initialDriverId = existing ? existing.driver_id : defaultDriverId ?? null;
  const initialDriver = data.drivers.find((driver) => driver.id === initialDriverId);

  const [driverId, setDriverId] = useState<string>(initialDriverId ?? NONE);
  // The driver's usual vehicle is only a sensible default when it is the kind of
  // vehicle the transport was planned with.
  const usualVehicle = data.vehicles.find((vehicle) => vehicle.id === initialDriver?.default_vehicle_id);
  const usualVehicleId = usualVehicle?.is_active && usualVehicle.vehicle_type === event.transport_type ? usualVehicle.id : null;
  const [vehicleId, setVehicleId] = useState<string>(
    (existing ? existing.vehicle_id : defaultVehicleId ?? usualVehicleId) ?? NONE,
  );
  const [start, setStart] = useState(initialWindow.start);
  const [end, setEnd] = useState(initialWindow.end);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<AssignmentConflict[] | null>(null);

  const selectedDriver = data.drivers.find((driver) => driver.id === driverId) ?? null;
  const selectedVehicle = data.vehicles.find((vehicle) => vehicle.id === vehicleId) ?? null;
  // Inactive vehicles stay selectable only if the assignment already uses them.
  const vehicleOptions = useMemo(
    () => data.vehicles.filter((vehicle) => vehicle.is_active || vehicle.id === existing?.vehicle_id),
    [data.vehicles, existing?.vehicle_id],
  );
  const warnings = driverVehicleWarnings(selectedDriver, selectedVehicle, event.event_date);
  const hasTarget = driverId !== NONE || vehicleId !== NONE;

  const submit = async (force: boolean) => {
    if (!hasTarget) {
      toast({ title: "Selecciona un conductor o un vehículo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const result = await saveDriverAssignment({
        eventId: event.id,
        driverId: driverId === NONE ? null : driverId,
        vehicleId: vehicleId === NONE ? null : vehicleId,
        startsAt: localInputToUTC(start, event.timezone).toISOString(),
        endsAt: localInputToUTC(end, event.timezone).toISOString(),
        notes,
        assignmentId: existing?.id ?? null,
        force,
      });
      if (result.status === "conflict") {
        setConflicts(result.conflicts);
        return;
      }
      toast({ title: existing ? "Asignación actualizada" : "Transporte asignado" });
      onSaved();
    } catch (error) {
      toast({ title: "No se pudo guardar", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(formEvent) => {
        formEvent.preventDefault();
        void submit(false);
      }}
    >
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <p className="font-medium">{transportEventTitle(event)}</p>
        <p className="text-muted-foreground">
          {event.event_time.slice(0, 5)} · {vehicleTypeLabel(event.transport_type)}
          {event.origin || event.destination ? ` · ${event.origin ?? "—"} → ${event.destination ?? "—"}` : ""}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="driver-assignment-driver">Conductor</Label>
          <Select value={driverId} onValueChange={(value) => { setDriverId(value); setConflicts(null); }}>
            <SelectTrigger id="driver-assignment-driver">
              <SelectValue placeholder="Sin conductor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin conductor</SelectItem>
              {data.drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>{driverDisplayName(driver)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="driver-assignment-vehicle">Vehículo</Label>
          <Select value={vehicleId} onValueChange={(value) => { setVehicleId(value); setConflicts(null); }}>
            <SelectTrigger id="driver-assignment-vehicle">
              <SelectValue placeholder="Sin vehículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin vehículo propio</SelectItem>
              {vehicleOptions.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicleLabel(vehicle)}{vehicle.is_active ? "" : " (inactivo)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="driver-assignment-start">Inicio</Label>
          <Input
            id="driver-assignment-start"
            type="datetime-local"
            value={start}
            onChange={(changeEvent) => { setStart(changeEvent.target.value); setConflicts(null); }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="driver-assignment-end">Fin</Label>
          <Input
            id="driver-assignment-end"
            type="datetime-local"
            value={end}
            min={start}
            onChange={(changeEvent) => { setEnd(changeEvent.target.value); setConflicts(null); }}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="driver-assignment-notes">Indicaciones para el conductor</Label>
        <Textarea
          id="driver-assignment-notes"
          value={notes}
          onChange={(changeEvent) => setNotes(changeEvent.target.value)}
          placeholder="Punto de recogida, contacto en destino, llaves…"
          rows={2}
        />
      </div>

      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Revisa la documentación</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((warning) => <li key={warning}>{DRIVER_WARNING_LABELS[warning]}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {conflicts && conflicts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Hay conflictos con esta asignación</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {conflicts.map((conflict) => (
                <li key={`${conflict.kind}-${conflict.assignment_id}`}>
                  {conflict.kind === "availability" ? (
                    <>Conductor no disponible{conflict.title ? `: ${conflict.title}` : ""}</>
                  ) : (
                    <>
                      {conflict.kind === "driver" ? "Conductor" : "Vehículo"} ocupado de{" "}
                      {formatTransportTime(conflict.starts_at, conflict.timezone)} a {formatTransportTime(conflict.ends_at, conflict.timezone)}
                      {conflict.title ? ` (${conflict.title})` : ""}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
        {conflicts && conflicts.length > 0 ? (
          <Button type="button" variant="destructive" onClick={() => void submit(true)} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar igualmente
          </Button>
        ) : (
          <Button type="submit" disabled={saving || !hasTarget}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {existing ? "Guardar cambios" : "Asignar"}
          </Button>
        )}
      </div>
    </form>
  );
}
