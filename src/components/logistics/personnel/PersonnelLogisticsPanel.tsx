import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";
import { usePersonnelOptions, usePersonnelPlans } from "@/features/logistics/personnel/personnelApi";
import { PERSONNEL_STATUSES, type PersonnelPlan } from "@/features/logistics/personnel/personnelModel";
import { workshopMonthBounds } from "@/features/logistics/fleet/workshopModel";
import { driverDisplayName } from "@/features/logistics/fleet/fleetModel";
import { formatMadridDateKey, formatInJobTimezone } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";
import { PersonnelPlanDialog } from "./PersonnelPlanDialog";
import { PersonnelReportDialog } from "./PersonnelReportDialog";

export function PersonnelLogisticsPanel({ readOnly }: { readOnly: boolean }) {
  const today = formatMadridDateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<{ plan: PersonnelPlan | null } | null>(null);
  const { first, last } = workshopMonthBounds(month);
  const plans = usePersonnelPlans(first, last);
  const options = usePersonnelOptions();
  const fleet = useLogisticsMatrix(first, last);
  const error = plans.error ?? options.error ?? fleet.error;
  const loading = plans.isLoading || options.isLoading || fleet.isLoading;
  const vehicles = fleet.data?.vehicles ?? [];
  const drivers = fleet.data?.drivers ?? [];
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Logística de personal</h2><p className="text-sm text-muted-foreground">Personas, traslados, vehículos, conductores y alojamiento por evento.</p></div>
      {!loading && !error && options.data && <div className="flex flex-wrap gap-2"><PersonnelReportDialog vehicles={vehicles} drivers={drivers} options={options.data} />{!readOnly && <Button onClick={() => setSelected({ plan: null })}>Nuevo traslado de personal</Button>}</div>}
    </div>
    <div className="flex items-center gap-2"><Label htmlFor="personnel-month">Mes de personal</Label><Input id="personnel-month" className="w-44" type="month" value={month} onChange={(event) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) setMonth(event.target.value); }} /></div>
    {error ? <div role="alert" className="space-y-2 text-destructive"><p>No se pudo cargar logística de personal: {getErrorMessage(error)}</p><Button variant="outline" onClick={() => { void plans.refetch(); void options.refetch(); void fleet.refetch(); }}>Reintentar</Button></div> : loading ? <p role="status">Cargando traslados de personal…</p> : !plans.data?.length ? <p className="py-6 text-muted-foreground">Todavía no hay traslados ni estancias para este mes.</p> : <div className="grid gap-4 xl:grid-cols-2">{plans.data.map((plan) => {
      const vehicle = vehicles.find((item) => item.id === plan.vehicle_id);
      const driver = drivers.find((item) => item.id === plan.driver_id);
      const location = (id: string) => options.data?.locations.find((item) => item.id === id)?.name ?? "Ubicación no disponible";
      return <Card key={plan.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{plan.title}</CardTitle><Badge variant="secondary">{PERSONNEL_STATUSES[plan.status]}</Badge></div></CardHeader><CardContent className="space-y-2 text-sm">
        <p className="font-medium">{plan.people_count} personas · {formatInJobTimezone(plan.starts_at, "dd/MM/yyyy HH:mm")} → {formatInJobTimezone(plan.ends_at, "dd/MM/yyyy HH:mm")}</p>
        <p>{location(plan.origin_location_id)} → {location(plan.destination_location_id)}</p>
        <p>{vehicle ? `${vehicle.name} · ${vehicle.license_plate}` : "Vehículo pendiente"} · {driver ? driverDisplayName(driver) : "Conductor pendiente"}</p>
        <p>{plan.hotel_needed ? `${plan.hotel_name || "Hotel por definir"} · ${plan.single_rooms} individuales + ${plan.double_rooms} dobles · ${plan.hotel_check_in} a ${plan.hotel_check_out} · Reserva ${plan.hotel_status === "confirmed" ? "confirmada" : "pendiente"}` : "Sin alojamiento"}</p>
        <Button size="sm" variant="outline" onClick={() => setSelected({ plan })}>{readOnly ? "Consultar traslado" : "Editar traslado"}</Button>
      </CardContent></Card>;
    })}</div>}
    {selected && options.data && <PersonnelPlanDialog key={selected.plan?.id ?? "new"} plan={selected.plan} day={month === today.slice(0, 7) ? today : first} options={options.data} vehicles={vehicles} drivers={drivers} readOnly={readOnly} onClose={() => setSelected(null)} />}
  </div>;
}
