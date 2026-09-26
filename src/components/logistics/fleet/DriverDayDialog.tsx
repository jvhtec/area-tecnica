import { useMemo, useState } from "react";
import { Loader2, MessageCircle, Pencil, Phone, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { transportProviderLabel } from "@/constants/transportProviders";
import { useToast } from "@/hooks/use-toast";
import { removeDriverAssignment } from "@/features/logistics/fleet/fleetApi";
import {
  DRIVER_ASSIGNMENT_STATUS_LABELS,
  transportOperationLabel,
  UNAVAILABILITY_LABELS,
  driverDisplayName,
  formatTransportTime,
  isExternallyHandledTransport,
  transportEventTitle,
  vehicleLabel,
  vehicleTypeLabel,
  type DriverAssignment,
  type FleetVehicle,
  type LogisticsMatrixData,
  type MatrixDriver,
  type MatrixTransportEvent,
} from "@/features/logistics/fleet/fleetModel";
import { useInvalidateLogisticsFleet } from "@/features/logistics/fleet/useLogisticsFleet";
import { getErrorMessage } from "@/utils/errorMessage";
import { buildTelHref, buildWhatsAppHref } from "@/utils/phoneLinks";
import { formatMadridDayKey } from "@/utils/timezoneUtils";
import { es } from "date-fns/locale";

import { DriverAssignmentForm } from "./DriverAssignmentForm";
import { assignmentStatusClass } from "./matrixStyles";

export type MatrixRowTarget =
  | { kind: "driver"; driver: MatrixDriver }
  | { kind: "vehicle"; vehicle: FleetVehicle };

type Editing = { event: MatrixTransportEvent; assignment: DriverAssignment | null };

type DriverDayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  row: MatrixRowTarget;
  data: LogisticsMatrixData;
  rowAssignments: DriverAssignment[];
  readOnly: boolean;
};

export function DriverDayDialog({ open, onOpenChange, dayKey, row, data, rowAssignments, readOnly }: DriverDayDialogProps) {
  const { toast } = useToast();
  const invalidate = useInvalidateLogisticsFleet();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const eventsById = useMemo(() => new Map(data.events.map((event) => [event.id, event])), [data.events]);
  const driversById = useMemo(() => new Map(data.drivers.map((driver) => [driver.id, driver])), [data.drivers]);
  const vehiclesById = useMemo(() => new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle])), [data.vehicles]);
  const dayEvents = useMemo(() => data.events.filter((event) => event.event_date === dayKey), [data.events, dayKey]);
  const assignmentsByEvent = useMemo(() => {
    const map = new Map<string, DriverAssignment[]>();
    for (const assignment of data.assignments) {
      map.set(assignment.logistics_event_id, [...(map.get(assignment.logistics_event_id) ?? []), assignment]);
    }
    return map;
  }, [data.assignments]);

  const rowName = row.kind === "driver" ? driverDisplayName(row.driver) : vehicleLabel(row.vehicle);
  const dayLabel = formatMadridDayKey(dayKey, "EEEE d 'de' MMMM", { locale: es });
  const offStatus = row.kind === "driver" ? row.driver.unavailable_days.find((day) => day.date === dayKey)?.status : undefined;
  // The RPC only returns a phone to admin/management, so read-only viewers never get these links.
  const phone = row.kind === "driver" ? row.driver.phone : null;
  const telHref = buildTelHref(phone);
  const whatsAppHref = buildWhatsAppHref(phone, `Hola ${rowName}, te escribo desde logística por el transporte del ${dayLabel}.`);

  const close = (next: boolean) => {
    if (!next) setEditing(null);
    onOpenChange(next);
  };

  const remove = async (assignment: DriverAssignment) => {
    setRemovingId(assignment.id);
    try {
      await removeDriverAssignment(assignment.id);
      toast({ title: "Asignación retirada" });
      await invalidate();
    } catch (error) {
      toast({ title: "No se pudo retirar", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const describeAssignee = (assignment: DriverAssignment) => {
    const driver = assignment.driver_id ? driversById.get(assignment.driver_id) : null;
    const vehicle = assignment.vehicle_id ? vehiclesById.get(assignment.vehicle_id) : null;
    return [driver ? driverDisplayName(driver) : null, vehicle ? vehicleLabel(vehicle) : null]
      .filter((part): part is string => Boolean(part))
      .join(" · ") || "Sin asignar";
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">{rowName}</DialogTitle>
          <DialogDescription className="first-letter:uppercase">
            {dayLabel}
            {offStatus ? ` · ${UNAVAILABILITY_LABELS[offStatus]}` : ""}
          </DialogDescription>
        </DialogHeader>

        {(telHref || whatsAppHref) && !editing && (
          <div className="flex flex-wrap gap-2">
            {whatsAppHref && (
              <Button asChild size="sm" variant="outline">
                <a href={whatsAppHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
                </a>
              </Button>
            )}
            {telHref && (
              <Button asChild size="sm" variant="outline">
                <a href={telHref}>
                  <Phone className="mr-1 h-4 w-4" /> Llamar
                </a>
              </Button>
            )}
          </div>
        )}

        {editing ? (
          <DriverAssignmentForm
            event={editing.event}
            data={data}
            existing={editing.assignment}
            defaultDriverId={row.kind === "driver" ? row.driver.id : null}
            defaultVehicleId={row.kind === "vehicle" ? row.vehicle.id : null}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              void invalidate();
            }}
          />
        ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Asignado este día</h3>
              {rowAssignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada asignado todavía.</p>
              ) : (
                <ul className="space-y-2">
                  {rowAssignments.map((assignment) => {
                    const event = eventsById.get(assignment.logistics_event_id);
                    return (
                      <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {formatTransportTime(assignment.starts_at, event?.timezone)}–{formatTransportTime(assignment.ends_at, event?.timezone)} ·{" "}
                            {event ? transportEventTitle(event) : "Transporte"}
                          </p>
                          <p className="text-muted-foreground">{describeAssignee(assignment)}</p>
                          {assignment.notes && <p className="text-muted-foreground">{assignment.notes}</p>}
                          {assignment.status === "declined" && assignment.decline_reason && (
                            <p className="break-words text-red-700 dark:text-red-300">Motivo: {assignment.decline_reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={assignmentStatusClass(assignment.status)}>
                            {DRIVER_ASSIGNMENT_STATUS_LABELS[assignment.status]}
                          </Badge>
                          {!readOnly && event && (
                            <Button size="icon" variant="ghost" aria-label="Editar asignación" onClick={() => setEditing({ event, assignment })}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {!readOnly && (
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Retirar asignación"
                              disabled={removingId === assignment.id}
                              onClick={() => void remove(assignment)}
                            >
                              {removingId === assignment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Transportes programados este día</h3>
              {dayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cargas ni descargas programadas.</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map((event) => {
                    const eventAssignments = (assignmentsByEvent.get(event.id) ?? []).filter((a) => a.status !== "declined");
                    const hiredFrom = isExternallyHandledTransport(event)
                      ? transportProviderLabel(event.transport_provider)
                      : null;
                    return (
                      <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {event.event_time.slice(0, 5)} · {transportOperationLabel(event.event_type, event.movement_type)} ·{" "}
                            {transportEventTitle(event)}
                          </p>
                          <p className="text-muted-foreground">
                            {vehicleTypeLabel(event.transport_type)}
                            {event.berth_count ? ` · ${event.berth_count} literas` : ""}
                            {event.departments.length > 0 ? ` · ${event.departments.join(", ")}` : ""}
                            {event.location_name ? ` · ${event.location_name}` : ""}
                          </p>
                          <p className={eventAssignments.length === 0 && !hiredFrom ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                            {eventAssignments.length > 0
                              ? eventAssignments.map(describeAssignee).join(" / ")
                              : hiredFrom
                                ? `Contratado a ${hiredFrom}`
                                : "Sin conductor ni vehículo"}
                          </p>
                        </div>
                        {!readOnly && (
                          <Button size="sm" variant="outline" onClick={() => setEditing({ event, assignment: null })}>
                            <Plus className="mr-1 h-4 w-4" />
                            Asignar
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
