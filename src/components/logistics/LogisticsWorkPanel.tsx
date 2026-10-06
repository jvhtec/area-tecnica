import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { listTransportRequests } from "@/features/logistics/transportRequests";
import { usePersonnelOptions, usePersonnelPlans } from "@/features/logistics/personnel/personnelApi";
import { useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";
import { useWorkshopAppointments } from "@/features/logistics/fleet/workshopApi";
import { driverDisplayName } from "@/features/logistics/fleet/fleetModel";
import { workshopMonthBounds } from "@/features/logistics/fleet/workshopModel";
import { workshopReportPeriod } from "@/features/logistics/fleet/workshopReport";
import { useOperations } from "@/features/logistics/operations/operationsApi";
import { itemOverlapsPeriod, operationKey, operationTotal, workItems, type WorkItem } from "@/features/logistics/operations/operationsModel";
import { resourceConflicts } from "@/features/logistics/operations/conflicts";
import { createOperationsReport } from "@/features/logistics/operations/operationsReport";
import { formatMadridDateKey } from "@/utils/timezoneUtils";
import { getErrorMessage } from "@/utils/errorMessage";
import { OperationDetailsDialog } from "./OperationDetailsDialog";
import { TransportRequestPlanningDialog } from "./TransportRequestPlanningDialog";
import { PersonnelPlanDialog } from "./personnel/PersonnelPlanDialog";

export function LogisticsWorkPanel({ readOnly, area }: { readOnly: boolean; area: "material" | "personnel" }) {
  const today = formatMadridDateKey(new Date());
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [planning, setPlanning] = useState<WorkItem | null>(null);
  const [reportError, setReportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const { first: weekFirst, last: weekLast } = workshopReportPeriod("weekly", date);
  const month = workshopMonthBounds(date.slice(0, 7));
  const first = weekFirst < month.first ? weekFirst : month.first;
  const last = weekLast > month.last ? weekLast : month.last;
  const requests = useQuery({ queryKey: ["logistics-work-requests"], queryFn: () => listTransportRequests({ includeClosed: true }), staleTime: 30000 });
  const plans = usePersonnelPlans(first, last);
  const options = usePersonnelOptions();
  const fleet = useLogisticsMatrix(first, last);
  const workshops = useWorkshopAppointments(first, last);
  const operations = useOperations();
  const queries = [requests, plans, options, fleet, workshops, operations];
  const failure = queries.find((q) => q.error)?.error;
  const loading = queries.some((q) => q.isLoading);
  const items = fleet.data ? workItems(requests.data ?? [], plans.data ?? [], fleet.data) : [];
  const map = new Map((operations.data ?? []).map((row) => [operationKey(row.entity_kind, row.entity_id), row]));
  const locationName = (id: string) => options.data?.locations.find((place) => place.id === id)?.name ?? "Ubicación pendiente";
  const pending = items.filter((item) => !item.closed && (item.missing.length > 0 || !map.get(operationKey(item.kind, item.id))?.responsible_id));
  const visible = items.filter((item) => {
    const matches = filter === "today" ? itemOverlapsPeriod(item, date, date) : filter === "pending" ? pending.includes(item) : filter === "department" ? item.kind === area && itemOverlapsPeriod(item, first, last) : itemOverlapsPeriod(item, first, last);
    return matches && item.title.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
  }).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  async function exportReport(period: "weekly" | "monthly") {
    setExporting(true); setReportError("");
    try {
      const from = period === "weekly" ? weekFirst : month.first, to = period === "weekly" ? weekLast : month.last;
      const workbook = await createOperationsReport(items, operations.data ?? [], from, to, options.data?.jobs);
      saveAs(new Blob([await workbook.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Logistica-${period === "weekly" ? "semanal" : "mensual"}-${from}.xlsx`);
    } catch (error) { setReportError(getErrorMessage(error)); } finally { setExporting(false); }
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Panel de trabajo</h2><p className="text-sm text-muted-foreground">Material y personal juntos. Fecha y semana según el horario de Madrid.</p></div><div className="flex gap-2"><Button variant="outline" disabled={loading || Boolean(failure) || exporting} onClick={() => void exportReport("weekly")}>Excel semanal</Button><Button variant="outline" disabled={loading || Boolean(failure) || exporting} onClick={() => void exportReport("monthly")}>Excel mensual</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-3">{[{ title: "Servicios del día", value: items.filter((item) => itemOverlapsPeriod(item, date, date) && !item.closed).length, filter: "today" }, { title: "Peticiones por resolver", value: pending.length, filter: "pending" }, { title: "Servicios del departamento", value: items.filter((item) => item.kind === area && itemOverlapsPeriod(item, first, last)).length, filter: "department" }].map((metric) => <Button key={metric.title} variant="outline" className="h-auto justify-between p-4" onClick={() => setFilter(metric.filter)} aria-pressed={filter === metric.filter}><span>{metric.title}</span><strong className="text-xl">{loading || failure ? "—" : metric.value}</strong></Button>)}</div>
    <div className="flex flex-wrap items-end gap-3"><div className="space-y-1"><Label htmlFor="work-date">Fecha de referencia</Label><Input id="work-date" type="date" value={date} onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && Number.isFinite(Date.parse(e.target.value))) setDate(e.target.value); }} /></div><div className="space-y-1"><Label htmlFor="work-search">Buscar evento</Label><Input id="work-search" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Button variant="outline" onClick={() => setFilter("all")}>Ver periodo completo</Button><Button variant="outline" onClick={() => { queries.forEach((q) => void q.refetch()); }}>Actualizar</Button></div>
    <p className="text-xs text-muted-foreground">Periodo cargado: {first} a {last}. Las solicitudes de material pendientes incluyen también las que aún no tienen fecha.</p>
    {(failure || reportError) && <p role="alert" className="text-destructive">{reportError || `No se pudo cargar el panel: ${getErrorMessage(failure)}. Comprueba que las migraciones de Logística estén instaladas.`}</p>}
    {loading ? <p role="status">Cargando servicios…</p> : !failure && !visible.length ? <p>No hay servicios para este filtro.</p> : !failure && <div className="grid gap-4 xl:grid-cols-2">{visible.map((item) => {
      const operation = map.get(operationKey(item.kind, item.id));
      const missing = [...item.missing, ...(!item.closed && !operation?.responsible_id ? ["Responsable"] : [])];
      let conflicts: string[] = [];
      if (item.kind === "personnel" && !item.closed && "starts_at" in item.source && fleet.data) {
        const plan = item.source;
        conflicts = resourceConflicts({ start: plan.starts_at, end: plan.ends_at, vehicleId: plan.vehicle_id, driverId: plan.driver_id, excludeEventIds: [] }, fleet.data.assignments.filter((a) => a.id !== plan.assignment_id), workshops.data ?? []);
      }
      return <Card key={operationKey(item.kind, item.id)} className={item.kind === "personnel" ? "border-l-4 border-l-violet-500" : "border-l-4 border-l-sky-500"}><CardHeader><div className="flex flex-wrap justify-between gap-2"><CardTitle className="text-lg">{item.title}</CardTitle><Badge variant="outline">{item.kind === "material" ? "Material" : "Personal"}</Badge></div></CardHeader><CardContent className="space-y-3 text-sm"><p>{item.date ?? "Fecha pendiente"} · {operation?.in_progress && !item.closed && ["Confirmado", "Confirmada"].includes(item.status) ? "En curso" : item.status}</p><p>{"people_count" in item.source ? `${item.source.people_count} personas` : item.source.description || "Material por detallar"}</p><p>{"origin" in item.source ? `${item.source.origin || "Origen pendiente"} → ${item.source.destination || "Destino pendiente"}` : `${locationName(item.source.origin_location_id)} → ${locationName(item.source.destination_location_id)}`}</p><p>Responsable: {operation?.responsible_name ?? "Sin asignar"}</p><p>{item.vehicleIds.map((id) => fleet.data?.vehicles.find((v) => v.id === id)?.name ?? "Vehículo no disponible").join(", ") || "Vehículo pendiente"} · {item.driverIds.map((id) => { const driver = fleet.data?.drivers.find((d) => d.id === id); return driver ? driverDisplayName(driver) : "Conductor no disponible"; }).join(", ") || "Conductor pendiente"}</p>{missing.length > 0 && <p className="font-medium text-amber-700 dark:text-amber-400">Falta: {missing.join(" · ")}</p>}{conflicts.map((warning) => <p key={warning} className="text-destructive">{warning}</p>)}<p>Coste registrado: {operationTotal(operation).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}{!operation || [operation.transport_cost, operation.hotel_cost, operation.other_cost].some((cost) => cost === null) ? " · Hay importes pendientes" : ""}</p><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(item)}>Responsable, gastos e historial</Button><Button size="sm" variant="outline" disabled={readOnly && item.kind === "material" || item.kind === "material" && item.closed} onClick={() => setPlanning(item)}>{readOnly ? "Consultar" : item.kind === "material" ? "Planificar material" : "Editar traslado"}</Button></div></CardContent></Card>;
    })}</div>}
    {selected && <OperationDetailsDialog key={operationKey(selected.kind, selected.id)} item={selected} operation={map.get(operationKey(selected.kind, selected.id))} drivers={fleet.data?.drivers ?? []} readOnly={readOnly} onClose={() => setSelected(null)} />}
    {planning?.kind === "material" && !readOnly && "planning_status" in planning.source && <TransportRequestPlanningDialog open request={planning.source} onOpenChange={(open) => { if (!open) { setPlanning(null); void requests.refetch(); } }} />}
    {planning?.kind === "personnel" && "starts_at" in planning.source && options.data && <PersonnelPlanDialog plan={planning.source} day={date} options={options.data} vehicles={fleet.data?.vehicles ?? []} drivers={fleet.data?.drivers ?? []} readOnly={readOnly} onClose={() => { setPlanning(null); void plans.refetch(); }} />}
  </div>;
}
