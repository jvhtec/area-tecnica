import { useState } from "react";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { FleetVehicle } from "@/features/logistics/fleet/fleetModel";
import { useWorkshopAppointments } from "@/features/logistics/fleet/workshopApi";
import { WORKSHOP_STATUSES, workshopMonthBounds, workshopOnDay, workshopStatusClass, type WorkshopAppointment } from "@/features/logistics/fleet/workshopModel";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/errorMessage";
import { addMadridCalendarDays, formatInJobTimezone, formatMadridDateKey, formatMadridDayKey } from "@/utils/timezoneUtils";
import { WorkshopAppointmentDialog } from "./WorkshopAppointmentDialog";

type Props = { vehicle: FleetVehicle; readOnly: boolean; onClose: () => void };

export function VehicleWorkshopCalendar({ vehicle, readOnly, onClose }: Props) {
  const today = formatMadridDateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<{ appointment: WorkshopAppointment | null; day: string } | null>(null);
  const { first, last, days } = workshopMonthBounds(month);
  const { data = [], isLoading, error, refetch } = useWorkshopAppointments(first, last);
  const appointments = data.filter((appointment) => appointment.vehicle_id === vehicle.id);
  // ISO weekdays run Monday (1) to Sunday (7), independent of browser timezone.
  const leadingDays = Number(formatMadridDayKey(first, "i")) - 1;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !selected) onClose(); }}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Calendario de {vehicle.name}</DialogTitle>
          <DialogDescription>{vehicle.license_plate} · Citas del vehículo. {readOnly ? "Pulsa una cita para consultarla." : "Pulsa un día para añadir una cita o una cita para editarla."}</DialogDescription>
        </DialogHeader>
        <p className="text-lg font-semibold capitalize">{formatMadridDayKey(first, "MMMM yyyy", { locale: es })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="icon" variant="outline" aria-label="Mes anterior del vehículo" onClick={() => setMonth(addMadridCalendarDays(first, -1).slice(0, 7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="month" className="w-44" aria-label="Mes del calendario del vehículo" value={month} onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value); }} />
          <Button size="icon" variant="outline" aria-label="Mes siguiente del vehículo" onClick={() => setMonth(addMadridCalendarDays(last, 1).slice(0, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setMonth(today.slice(0, 7))}>Este mes</Button>
          {!readOnly && <Button disabled={isLoading || Boolean(error)} onClick={() => setSelected({ appointment: null, day: month === today.slice(0, 7) ? today : first })}><Plus className="mr-1 h-4 w-4" /> Nueva cita</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(WORKSHOP_STATUSES).map(([key, label]) => <Badge key={key} variant="outline" className={workshopStatusClass[key as WorkshopAppointment["status"]]}>{label}</Badge>)}
        </div>
        {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>No se pudieron cargar las citas: {getErrorMessage(error)}</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div>
          : isLoading ? <p role="status" className="text-sm text-muted-foreground">Cargando citas del vehículo…</p>
          : <div className="overflow-x-auto rounded-md border" tabIndex={0} aria-label={`Calendario mensual de ${vehicle.name}`}>
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 bg-muted text-center text-xs font-medium">
                {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map((day) => <div key={day} className="p-2">{day}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: leadingDays }, (_, index) => <div key={`blank-${index}`} aria-hidden className="border-b border-r bg-muted/20" />)}
                {days.map((day) => <div key={day} className={cn("min-h-28 space-y-1 border-b border-r p-2", day === today && "bg-primary/5")}>
                  <p className={cn("text-sm font-medium", day === today && "text-primary")}>{formatMadridDayKey(day, "d")}{day === today && <span className="ml-1 text-xs">Hoy</span>}</p>
                  {appointments.filter((appointment) => workshopOnDay(appointment, day)).map((appointment) => <button key={appointment.id} type="button" className={cn("block w-full rounded border p-1.5 text-left text-xs break-words focus-visible:ring-2 focus-visible:ring-ring", workshopStatusClass[appointment.status])} onClick={() => setSelected({ appointment, day })}>
                    <span className="block font-semibold">{formatMadridDateKey(new Date(appointment.starts_at)) === day ? formatInJobTimezone(appointment.starts_at, "HH:mm") : "Continúa"} · {appointment.reason}</span>
                    <span className="block">{appointment.workshop}</span>
                    <span className="block">{WORKSHOP_STATUSES[appointment.status]}</span>
                  </button>)}
                  {!readOnly && <button type="button" className="flex min-h-8 w-full items-center justify-center rounded text-xs text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Añadir cita para ${vehicle.name} el ${day}`} onClick={() => setSelected({ appointment: null, day })}><Plus className="mr-1 h-3 w-3" /> Cita</button>}
                </div>)}
              </div>
            </div>
          </div>}
        {selected && <WorkshopAppointmentDialog key={`${selected.appointment?.id ?? "new"}:${selected.day}`} {...selected} vehicleId={vehicle.id} vehicles={[vehicle]} readOnly={readOnly} onClose={() => setSelected(null)} />}
      </DialogContent>
    </Dialog>
  );
}
