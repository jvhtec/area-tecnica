import { useState } from "react";
import { saveAs } from "file-saver";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";
import { driverDisplayName, transportEventTitle, vehicleLabel } from "@/features/logistics/fleet/fleetModel";
import { workshopMonthBounds } from "@/features/logistics/fleet/workshopModel";
import { formatInJobTimezone, formatMadridDateKey } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";

export function FleetHistoryPanel() {
  const today = formatMadridDateKey(new Date());
  const month = workshopMonthBounds(today.slice(0, 7));
  const [first, setFirst] = useState(month.first);
  const [last, setLast] = useState(month.last);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const valid = Boolean(first && last && Number.isFinite(Date.parse(first)) && Number.isFinite(Date.parse(last)) && first <= last && (Date.parse(last) - Date.parse(first)) / 86400000 <= 92);
  const query = useLogisticsMatrix(first, last, valid);
  const rows = (query.data?.assignments ?? []).filter((a) => (!driverId || a.driver_id === driverId) && (!vehicleId || a.vehicle_id === vehicleId) && formatMadridDateKey(new Date(a.starts_at)) <= last && formatMadridDateKey(new Date(Date.parse(a.ends_at) - 1)) >= first).map((a) => {
    const event = query.data?.events.find((e) => e.id === a.logistics_event_id);
    const driver = query.data?.drivers.find((d) => d.id === a.driver_id);
    const vehicle = query.data?.vehicles.find((v) => v.id === a.vehicle_id);
    return { id: a.id, event: event?.job_title || (event ? transportEventTitle(event) : "Evento no disponible"), service: event ? transportEventTitle(event) : "Servicio no disponible", driver: driver ? driverDisplayName(driver) : "Sin conductor", vehicle: vehicle ? vehicleLabel(vehicle) : "Sin vehículo", starts: a.starts_at, ends: a.ends_at, status: a.status === "confirmed" ? "Confirmado" : a.status === "declined" ? "Rechazado" : "Asignado", route: [event?.origin, event?.destination || event?.location_address || event?.location_name].filter(Boolean).join(" → "), notes: a.notes ?? "" };
  }).filter((row) => `${row.event} ${row.service}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))).sort((a, b) => b.starts.localeCompare(a.starts));
  const headings = ["Evento", "Servicio", "Conductor", "Vehículo y matrícula", "Salida (Madrid)", "Llegada (Madrid)", "Estado", "Ruta", "Observaciones"];
  const values = rows.map((row) => [row.event, row.service, row.driver, row.vehicle, formatInJobTimezone(row.starts, "dd/MM/yyyy HH:mm"), formatInJobTimezone(row.ends, "dd/MM/yyyy HH:mm"), row.status, row.route, row.notes]);
  async function download() {
    setSaving(true); setError("");
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Historial de flota");
      sheet.addRow(["Historial de servicios de flota"]);
      sheet.addRow(["Periodo", first, last]);
      sheet.addRow(["Conductor", driverId ? query.data?.drivers.find((d) => d.id === driverId) && driverDisplayName(query.data.drivers.find((d) => d.id === driverId)!) : "Todos", "Vehículo", vehicleId ? query.data?.vehicles.find((v) => v.id === vehicleId) && vehicleLabel(query.data.vehicles.find((v) => v.id === vehicleId)!) : "Todos", "Evento", search || "Todos"]);
      sheet.addRow(["Asignaciones registradas; el estado no acredita que el servicio se haya realizado. Incluye rechazadas. Horario de Madrid."]);
      sheet.addRow(headings);
      sheet.addRows(values);
      sheet.columns.forEach((column) => { column.width = 30; });
      sheet.getRow(5).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(5).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF23446B" } }; });
      sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; row.height = 36; });
      sheet.getRow(4).height = 45;
      sheet.mergeCells("A1:I1"); sheet.mergeCells("A4:I4");
      sheet.views = [{ state: "frozen", ySplit: 5 }];
      sheet.autoFilter = { from: "A5", to: `I${Math.max(5, sheet.rowCount)}` };
      saveAs(new Blob([await workbook.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Historial-flota-${first}-${last}.xlsx`);
    } catch (failure) { setError(getErrorMessage(failure)); }
    finally { setSaving(false); }
  }
  return <Card className="xl:col-span-2"><CardHeader><CardTitle>Historial de servicios de flota</CardTitle><p className="text-sm text-muted-foreground">Consulta qué conductor y vehículo se asignaron a cada evento. Los estados distinguen asignaciones confirmadas y rechazadas; no acreditan la asistencia.</p></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div><Label htmlFor="history-first">Historial desde</Label><Input id="history-first" type="date" value={first} onChange={(e) => setFirst(e.target.value)} /></div>
      <div><Label htmlFor="history-last">Historial hasta</Label><Input id="history-last" type="date" value={last} onChange={(e) => setLast(e.target.value)} /></div>
      <div><Label htmlFor="history-driver">Conductor del historial</Label><select id="history-driver" className="h-10 w-full rounded-md border bg-background px-3" value={driverId} onChange={(e) => setDriverId(e.target.value)}><option value="">Todos</option>{query.data?.drivers.map((d) => <option key={d.id} value={d.id}>{driverDisplayName(d)}</option>)}</select></div>
      <div><Label htmlFor="history-vehicle">Vehículo del historial</Label><select id="history-vehicle" className="h-10 w-full rounded-md border bg-background px-3" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}><option value="">Todos</option>{query.data?.vehicles.map((v) => <option key={v.id} value={v.id}>{vehicleLabel(v)}</option>)}</select></div>
      <div><Label htmlFor="history-event">Buscar evento en historial</Label><Input id="history-event" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    </div>
    <Button disabled={!valid || query.isLoading || Boolean(query.error) || saving} onClick={() => void download()}>{saving ? "Preparando Excel…" : "Descargar historial en Excel"}</Button>
    {!valid ? <p role="alert">Selecciona un periodo válido de hasta 93 días. Puedes consultar cualquier mes anterior.</p> : query.error ? <p role="alert">{getErrorMessage(query.error)}</p> : query.isLoading ? <p>Cargando historial…</p> : <><p className="text-sm">{rows.length} servicios encontrados</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{headings.slice(0, 7).map((title) => <th key={title} className="p-2">{title}</th>)}</tr></thead><tbody>{values.map((row, index) => <tr key={rows[index].id} className="border-t">{row.slice(0, 7).map((value, col) => <td key={col} className="p-2 align-top">{value}</td>)}</tr>)}</tbody></table></div>{!rows.length && <p className="text-sm text-muted-foreground">No hay asignaciones registradas que coincidan con estos filtros.</p>}</>}
    {error && <p role="alert">{error}</p>}
  </CardContent></Card>;
}

