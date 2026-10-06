import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useInvalidateLogisticsFleet, useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";
import { driverDisplayName, UNAVAILABILITY_LABELS } from "@/features/logistics/fleet/fleetModel";
import { workshopMonthBounds } from "@/features/logistics/fleet/workshopModel";
import { formatMadridDateKey } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";

export function DriverLeavePanel({ readOnly }: { readOnly: boolean }) {
  const today = formatMadridDateKey(new Date());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [driver, setDriver] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [status, setStatus] = useState("day_off");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const bounds = workshopMonthBounds(month);
  const query = useLogisticsMatrix(bounds.first, bounds.last);
  const invalidate = useInvalidateLogisticsFleet();
  async function save() {
    setMessage("");
    if (!driver || !start || !end || end < start) { setMessage("Selecciona conductor y un periodo válido."); return; }
    setSaving(true);
    try {
      const rpc = dataLayerClient.rpc as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>;
      const result = await rpc.call(dataLayerClient, "set_logistics_driver_leave", { p_driver: driver, p_start: start, p_end: end, p_status: status });
      if (result.error) throw new Error(result.error.message);
      setMonth(start.slice(0, 7));
      await invalidate();
      setMessage(status === "clear" ? "Periodo liberado." : "Periodo guardado. Ya aparece en Conductores.");
    } catch (error) { setMessage(getErrorMessage(error)); }
    finally { setSaving(false); }
  }
  return <Card className="xl:col-span-2"><CardHeader><CardTitle>Descansos y vacaciones de conductores</CardTitle><p className="text-sm text-muted-foreground">Registra un día o varios días consecutivos. La fecha final también está incluida.</p></CardHeader><CardContent className="space-y-4">
    {!readOnly && <fieldset disabled={saving || query.isLoading || Boolean(query.error)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div><Label htmlFor="leave-driver">Conductor</Label><select id="leave-driver" className="h-10 w-full rounded-md border bg-background px-3" value={driver} onChange={(e) => setDriver(e.target.value)}><option value="">Selecciona conductor</option>{query.data?.drivers.map((d) => <option key={d.id} value={d.id}>{driverDisplayName(d)}</option>)}</select></div>
      <div><Label htmlFor="leave-status">Tipo de periodo</Label><select id="leave-status" className="h-10 w-full rounded-md border bg-background px-3" value={status} onChange={(e) => setStatus(e.target.value)}><option value="day_off">Descanso</option><option value="vacation">Vacaciones</option><option value="clear">Quitar descanso o vacaciones</option></select></div>
      <div><Label htmlFor="leave-start">Desde</Label><Input id="leave-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
      <div><Label htmlFor="leave-end">Hasta (incluido)</Label><Input id="leave-end" type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <Button onClick={() => void save()} disabled={saving}>{saving ? "Guardando…" : "Guardar periodo"}</Button>
    </fieldset>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <div className="max-w-xs"><Label htmlFor="leave-month">Mes a consultar</Label><Input id="leave-month" type="month" value={month} onChange={(e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value); }} /></div>
    {query.error ? <p role="alert">{getErrorMessage(query.error)}</p> : query.isLoading ? <p>Cargando periodos…</p> : <ul className="divide-y">{query.data?.drivers.map((d) => <li key={d.id} className="py-3"><p className="font-medium">{driverDisplayName(d)}</p><p className="text-sm text-muted-foreground">{d.unavailable_days.filter((day) => day.date >= bounds.first && day.date <= bounds.last).map((day) => `${day.date.split("-").reverse().join("/")} · ${UNAVAILABILITY_LABELS[day.status]}`).join("; ") || "Sin días no disponibles registrados en este mes."}</p></li>)}</ul>}
  </CardContent></Card>;
}
