import { useState } from "react";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FleetVehicle } from "@/features/logistics/fleet/fleetModel";
import { useWorkshopAppointments } from "@/features/logistics/fleet/workshopApi";
import { WORKSHOP_STATUSES, workshopMonthBounds, workshopOnDay, workshopStatusClass, type WorkshopAppointment } from "@/features/logistics/fleet/workshopModel";
import { addMadridCalendarDays, formatMadridDateKey, formatMadridDayKey, formatInJobTimezone, isMadridWeekend } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";
import { WorkshopAppointmentDialog } from "./WorkshopAppointmentDialog";

export function WorkshopCalendar({ vehicles, readOnly }: { vehicles: FleetVehicle[]; readOnly: boolean }) {
  const today = formatMadridDateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<{ appointment: WorkshopAppointment | null; vehicleId: string; day: string } | null>(null);
  const { first, last, days } = workshopMonthBounds(month);
  const { data: appointments = [], isLoading, error, refetch } = useWorkshopAppointments(first, last);
  return (
    <Card className="min-w-0 xl:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><CardTitle>Cuadrante de taller</CardTitle><CardDescription>Citas por vehículo. Pulsa una cita para consultarla{!readOnly && " o una casilla para añadir otra"}.</CardDescription></div>
          {!readOnly && <Button disabled={!vehicles.length || isLoading || Boolean(error)} onClick={() => setSelected({ appointment: null, vehicleId: vehicles[0].id, day: month === today.slice(0, 7) ? today : first })}><Plus className="mr-1 h-4 w-4" /> Nueva cita</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button size="icon" variant="outline" aria-label="Mes anterior" onClick={() => setMonth(addMadridCalendarDays(first, -1).slice(0, 7))}><ChevronLeft className="h-4 w-4" /></Button>
          <Input className="w-44" type="month" aria-label="Mes del cuadrante" value={month} onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value); }} />
          <Button size="icon" variant="outline" aria-label="Mes siguiente" onClick={() => setMonth(addMadridCalendarDays(last, 1).slice(0, 7))}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={() => setMonth(today.slice(0, 7))}>Este mes</Button>
          {Object.entries(WORKSHOP_STATUSES).map(([key, label]) => <Badge key={key} variant="outline" className={workshopStatusClass[key as WorkshopAppointment["status"]]}>{label}</Badge>)}
        </div>
      </CardHeader>
      <CardContent>
        {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>No se pudieron cargar las citas: {getErrorMessage(error)}</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button></div>
          : isLoading ? <p role="status" className="text-sm text-muted-foreground">Cargando citas de taller…</p>
          : !vehicles.length ? <p className="text-sm text-muted-foreground">Añade los vehículos a la flota para programar sus citas.</p>
          : <div className="max-w-full overflow-x-auto rounded-md border" tabIndex={0} aria-label="Cuadrante mensual de taller, desplazamiento horizontal">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Citas de taller de {formatMadridDayKey(first, "MMMM yyyy", { locale: es })}</caption>
              <thead><tr><th scope="col" className="sticky left-0 z-20 min-w-36 border-b border-r bg-muted p-2 text-left">Vehículo</th>{days.map((day) => <th key={day} scope="col" className={cn("min-w-28 border-b border-r p-2", isMadridWeekend(day) && "bg-muted/50", day === today && "bg-primary/10")}>{formatMadridDayKey(day, "EEE d", { locale: es })}</th>)}</tr></thead>
              <tbody>{vehicles.map((vehicle) => <tr key={vehicle.id}>
                <th scope="row" className="sticky left-0 z-10 border-b border-r bg-background p-2 text-left align-top"><span className="block">{vehicle.name}</span><span className="block text-xs font-normal text-muted-foreground">{vehicle.license_plate}{!vehicle.is_active && " · inactivo"}</span></th>
                {days.map((day) => <td key={day} className={cn("border-b border-r p-1 align-top", isMadridWeekend(day) && "bg-muted/30", day === today && "bg-primary/5")}>
                  <div className="min-h-20 space-y-1">
                    {appointments.filter((appointment) => appointment.vehicle_id === vehicle.id && workshopOnDay(appointment, day)).map((appointment) => <button key={appointment.id} type="button" className={cn("block w-full rounded border p-1.5 text-left text-xs focus-visible:ring-2 focus-visible:ring-ring", workshopStatusClass[appointment.status])} onClick={() => setSelected({ appointment, vehicleId: vehicle.id, day })}>
                      <span className="block font-semibold">{formatMadridDateKey(new Date(appointment.starts_at)) === day ? formatInJobTimezone(appointment.starts_at, "HH:mm") : "Continúa"} · {appointment.reason}</span>
                      <span className="block">{appointment.workshop}</span><span className="block">{WORKSHOP_STATUSES[appointment.status]}</span>
                    </button>)}
                    {!readOnly && <button type="button" className="flex min-h-8 w-full items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Añadir cita para ${vehicle.name} el ${day}`} onClick={() => setSelected({ appointment: null, vehicleId: vehicle.id, day })}><Plus className="h-3 w-3" /></button>}
                  </div>
                </td>)}
              </tr>)}</tbody>
            </table>
          </div>}
      </CardContent>
      {selected && <WorkshopAppointmentDialog key={`${selected.appointment?.id ?? "new"}:${selected.vehicleId}:${selected.day}`} {...selected} vehicles={vehicles} readOnly={readOnly} onClose={() => setSelected(null)} />}
    </Card>
  );
}
