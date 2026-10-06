import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERSONNEL_STATUSES, personnelLocalInstant, validatePersonnelPlan, type PersonnelInput, type PersonnelPlan, type PersonnelOptions } from "@/features/logistics/personnel/personnelModel";
import { savePersonnelPlan, useInvalidatePersonnel, personnelDestinationFromAddress } from "@/features/logistics/personnel/personnelApi";
import { driverDisplayName, vehicleLabel, type FleetVehicle, type MatrixDriver } from "@/features/logistics/fleet/fleetModel";
import { formatInJobTimezone } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";
import { useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";
import { useWorkshopAppointments } from "@/features/logistics/fleet/workshopApi";
import { resourceConflicts } from "@/features/logistics/operations/conflicts";

type Props = { plan: PersonnelPlan | null; day: string; options: PersonnelOptions; vehicles: FleetVehicle[]; drivers: MatrixDriver[]; readOnly: boolean; onClose: () => void };
export function PersonnelPlanDialog({ plan, day, options, vehicles, drivers, readOnly, onClose }: Props) {
  const invalidate = useInvalidatePersonnel();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinationMode, setDestinationMode] = useState<"saved" | "address">("saved");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [form, setForm] = useState<PersonnelInput>(() => plan ? { ...plan } : { id: null, title: "", job_id: null, people_count: 1, starts_at: "", ends_at: "", origin_location_id: "", destination_location_id: "", vehicle_id: null, driver_id: null, status: "planned", hotel_needed: false, hotel_name: null, hotel_address: null, hotel_check_in: null, hotel_check_out: null, single_rooms: 0, double_rooms: 0, hotel_status: "pending", notes: null });
  const [start, setStart] = useState(plan ? formatInJobTimezone(plan.starts_at, "yyyy-MM-dd'T'HH:mm") : `${day}T09:00`);
  const [end, setEnd] = useState(plan ? formatInJobTimezone(plan.ends_at, "yyyy-MM-dd'T'HH:mm") : `${day}T11:00`);
  const first = /^\d{4}-\d{2}-\d{2}/.test(start) ? start.slice(0, 10) : day;
  const last = /^\d{4}-\d{2}-\d{2}/.test(end) && end.slice(0, 10) >= first ? end.slice(0, 10) : first;
  const matrix = useLogisticsMatrix(first, last, !readOnly);
  const workshop = useWorkshopAppointments(first, last);
  let warnings: string[] = [];
  if (form.status === "planned" || form.status === "confirmed") {
    try { warnings = resourceConflicts({ start: personnelLocalInstant(start), end: personnelLocalInstant(end), vehicleId: form.vehicle_id, driverId: form.driver_id, excludeEventIds: [] }, (matrix.data?.assignments ?? []).filter((a) => a.id !== plan?.assignment_id), workshop.data ?? []); } catch { /* Date validation is shown on submission. */ }
  }
  if (["planned", "confirmed"].includes(form.status) && matrix.data?.drivers.find((d) => d.id === form.driver_id)?.unavailable_days.some((d) => d.date >= first && d.date <= last)) warnings.push("El conductor tiene descanso, vacaciones u otra ausencia en este periodo.");
  const preflightPending = (form.status === "planned" || form.status === "confirmed") && (Boolean(form.vehicle_id) || Boolean(form.driver_id)) && (matrix.isLoading || workshop.isLoading);
  const preflightError = (form.status === "planned" || form.status === "confirmed") && (Boolean(form.vehicle_id) || Boolean(form.driver_id)) && (matrix.error ?? workshop.error);
  const update = <K extends keyof PersonnelInput>(key: K, value: PersonnelInput[K]) => setForm((old) => ({ ...old, [key]: value }));
  const selectClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";
  const submit = async () => {
    if (saving || readOnly) return;
    setSaving(true); setError(null);
    try {
      const input = { ...form, starts_at: personnelLocalInstant(start), ends_at: personnelLocalInstant(end) };
      if (destinationMode === "address") {
        if (!destinationAddress.trim() || destinationAddress.trim().length > 300) throw new Error("Escribe la dirección del destino.");
        input.destination_location_id = "00000000-0000-0000-0000-000000000001";
      }
      const validation = validatePersonnelPlan(input, vehicles, drivers);
      if (validation) throw new Error(validation);
      if (preflightPending) throw new Error("Espera a que termine la comprobación de disponibilidad.");
      if (preflightError) throw new Error("No se pudo comprobar la disponibilidad. Reintenta antes de guardar.");
      if (warnings.length) throw new Error(warnings.join(" "));
      if (destinationMode === "address") {
        input.destination_location_id = await personnelDestinationFromAddress(destinationAddress);
        if (input.destination_location_id === input.origin_location_id) throw new Error("El origen y el destino deben ser diferentes.");
      }
      await savePersonnelPlan(input, plan?.updated_at ?? null);
      await invalidate(); onClose();
    } catch (failure) { setError(getErrorMessage(failure)); }
    finally { setSaving(false); }
  };
  const field = (id: string, label: string, content: React.ReactNode) => <div key={id} className="space-y-1"><Label htmlFor={id}>{label}</Label>{content}</div>;
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent className="sm:max-w-3xl">
    <DialogHeader><DialogTitle>{readOnly ? "Traslado de personal" : plan ? "Editar traslado de personal" : "Nuevo traslado de personal"}</DialogTitle></DialogHeader>
    <form id="personnel-plan" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <fieldset disabled={saving || readOnly} className="grid gap-3 sm:grid-cols-2">
        {field("personnel-title", "Evento / nombre del traslado", <Input id="personnel-title" required maxLength={200} value={form.title} onChange={(event) => update("title", event.target.value)} />)}
        {field("personnel-job", "Vincular a evento (opcional)", <select id="personnel-job" className={selectClass} value={form.job_id ?? ""} onChange={(event) => { update("job_id", event.target.value || null); const job = options.jobs.find((j) => j.id === event.target.value); if (job && (!form.title || form.title === options.jobs.find((j) => j.id === form.job_id)?.title)) update("title", job.title); }}><option value="">Sin vincular</option>{options.jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select>)}
        {field("personnel-people", "Número de personas", <Input id="personnel-people" type="number" min={1} max={10000} step={1} required value={form.people_count} onChange={(event) => update("people_count", Number(event.target.value))} />)}
        {field("personnel-status", "Estado del traslado", <select id="personnel-status" className={selectClass} value={form.status} onChange={(event) => update("status", event.target.value as PersonnelInput["status"])}>{Object.entries(PERSONNEL_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>)}
        {field("personnel-start", "Salida", <Input id="personnel-start" type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)} />)}
        {field("personnel-end", "Llegada / fin del traslado", <Input id="personnel-end" type="datetime-local" required value={end} onChange={(event) => setEnd(event.target.value)} />)}
        {field("origin_location_id", "Punto de encuentro", <select id="origin_location_id" className={selectClass} required value={form.origin_location_id} onChange={(event) => update("origin_location_id", event.target.value)}><option value="">Selecciona una ubicación</option>{options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>)}
        <div className="space-y-2">
          {field("personnel-destination-mode", "Cómo indicar el destino", <select id="personnel-destination-mode" className={selectClass} value={destinationMode} onChange={(event) => setDestinationMode(event.target.value as "saved" | "address")}><option value="saved">Elegir ubicación guardada</option><option value="address">Escribir dirección</option></select>)}
          {destinationMode === "address" ? field("personnel-destination-address", "Dirección del destino", <Input id="personnel-destination-address" required maxLength={300} placeholder="Calle, número, localidad y código postal" value={destinationAddress} onChange={(event) => setDestinationAddress(event.target.value)} />) : field("destination_location_id", "Destino", <select id="destination_location_id" className={selectClass} required value={form.destination_location_id} onChange={(event) => update("destination_location_id", event.target.value)}><option value="">Selecciona una ubicación</option>{options.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>)}
        </div>
        {field("personnel-vehicle", "Vehículo", <select id="personnel-vehicle" className={selectClass} value={form.vehicle_id ?? ""} onChange={(event) => update("vehicle_id", event.target.value || null)}><option value="">Pendiente de asignar</option>{vehicles.filter((vehicle) => ["furgoneta", "rv", "sleeper_bus"].includes(vehicle.vehicle_type)).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle)} · {vehicle.passenger_seats ?? "?"} plazas</option>)}</select>)}
        {field("personnel-driver", "Conductor", <select id="personnel-driver" className={selectClass} value={form.driver_id ?? ""} onChange={(event) => update("driver_id", event.target.value || null)}><option value="">Pendiente de asignar</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driverDisplayName(driver)}</option>)}</select>)}
        <p className="text-xs text-muted-foreground sm:col-span-2">Horario de Madrid. Para varios vehículos, crea un traslado por grupo. La dirección escrita se guarda como ubicación para reutilizarla.</p>
        <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={form.hotel_needed} onChange={(event) => update("hotel_needed", event.target.checked)} /> Necesita hotel</label>
        {form.hotel_needed && <>
          {field("personnel-hotel", "Hotel", <Input id="personnel-hotel" maxLength={200} placeholder="Por definir" value={form.hotel_name ?? ""} onChange={(event) => update("hotel_name", event.target.value || null)} />)}
          {field("personnel-hotel-address", "Dirección del hotel", <Input id="personnel-hotel-address" maxLength={300} value={form.hotel_address ?? ""} onChange={(event) => update("hotel_address", event.target.value || null)} />)}
          {field("personnel-check-in", "Entrada al hotel", <Input id="personnel-check-in" type="date" required value={form.hotel_check_in ?? ""} onChange={(event) => update("hotel_check_in", event.target.value || null)} />)}
          {field("personnel-check-out", "Salida del hotel", <Input id="personnel-check-out" type="date" required value={form.hotel_check_out ?? ""} onChange={(event) => update("hotel_check_out", event.target.value || null)} />)}
          {field("personnel-single", "Habitaciones individuales", <Input id="personnel-single" type="number" min={0} max={10000} step={1} value={form.single_rooms} onChange={(event) => update("single_rooms", Number(event.target.value))} />)}
          {field("personnel-double", "Habitaciones dobles", <Input id="personnel-double" type="number" min={0} max={10000} step={1} value={form.double_rooms} onChange={(event) => update("double_rooms", Number(event.target.value))} />)}
          {field("personnel-booking", "Reserva de hotel", <select id="personnel-booking" className={selectClass} value={form.hotel_status} onChange={(event) => update("hotel_status", event.target.value as "pending" | "confirmed")}><option value="pending">Pendiente</option><option value="confirmed">Confirmada</option></select>)}
          <p className="self-center text-sm">{form.single_rooms + form.double_rooms} habitaciones · {form.single_rooms + 2 * form.double_rooms} plazas de alojamiento</p>
        </>}
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="personnel-notes">Observaciones</Label><Textarea id="personnel-notes" maxLength={2000} value={form.notes ?? ""} onChange={(event) => update("notes", event.target.value || null)} /></div>
      </fieldset>
      {warnings.length > 0 && <div role="alert" className="mt-3 rounded-md border border-destructive p-3 text-sm text-destructive">{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
      {preflightPending && <p role="status" className="mt-3 text-sm">Comprobando vehículo, conductor y taller…</p>}
      {preflightError && <p role="alert" className="mt-3 text-sm text-destructive">No se pudo comprobar la disponibilidad. <Button variant="outline" type="button" onClick={() => { void matrix.refetch(); void workshop.refetch(); }}>Reintentar</Button></p>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </form>
    <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Cerrar</Button>{!readOnly && <Button form="personnel-plan" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar traslado"}</Button>}</DialogFooter>
  </DialogContent></Dialog>;
}

