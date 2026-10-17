import { useState } from "react";
import { Label } from "@/components/ui/label";
import { useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";
import { driverDisplayName } from "@/features/logistics/fleet/fleetModel";
import { getErrorMessage } from "@/utils/errorMessage";
export type CalendarResourceFilters = { driverId: string; vehicleId: string; jobId: string };
export function useCalendarFilters(first: string, last: string, selected?: CalendarResourceFilters, onChange?: (filters: CalendarResourceFilters) => void) {
  const matrix = useLogisticsMatrix(first, last);
  const [local, setLocal] = useState<CalendarResourceFilters>({ driverId: "", vehicleId: "", jobId: "" });
  const { driverId, vehicleId, jobId } = selected ?? local;
  const change = (key: keyof CalendarResourceFilters, value: string) => { const next = { ...(selected ?? local), [key]: value }; setLocal(next); onChange?.(next); };
  const setDriverId = (value: string) => change("driverId", value);
  const setVehicleId = (value: string) => change("vehicleId", value);
  const setJobId = (value: string) => change("jobId", value);
  const jobs = [...new Map((matrix.data?.events ?? []).filter((event) => event.job_id).map((event) => [event.job_id!, event.job_title ?? "Evento sin nombre"])).entries()];
  const matches = (event: { id: string; job_id?: string | null }) => {
    if (jobId && event.job_id !== jobId) return false;
    if (!driverId && !vehicleId) return true;
    return matrix.data?.assignments.some((a) => a.logistics_event_id === event.id && a.status !== "declined" && (!driverId || a.driver_id === driverId) && (!vehicleId || a.vehicle_id === vehicleId)) ?? false;
  };
  const field = (id: string, label: string, value: string, change: (v: string) => void, options: [string, string][]) => <div className="min-w-0 space-y-1"><Label htmlFor={id}>{label}</Label><select id={id} className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={value} onChange={(e) => change(e.target.value)}><option value="">Todos</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></div>;
  const controls = <div className="space-y-2"><div className="grid gap-2 sm:grid-cols-3">{field("calendar-driver", "Filtrar por conductor", driverId, setDriverId, (matrix.data?.drivers ?? []).map((d) => [d.id, driverDisplayName(d)]))}{field("calendar-vehicle", "Filtrar por vehículo", vehicleId, setVehicleId, (matrix.data?.vehicles ?? []).map((v) => [v.id, `${v.name} · ${v.license_plate}`]))}{field("calendar-job", "Filtrar por evento", jobId, setJobId, jobs)}</div><p className="flex flex-wrap gap-3 text-xs"><span className="text-sky-700 dark:text-sky-400">● Material</span><span className="text-violet-700 dark:text-violet-400">● Personal</span></p>{matrix.isLoading && <p role="status" className="text-sm">Cargando filtros…</p>}{matrix.error && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los filtros: {getErrorMessage(matrix.error)}</p>}</div>;
  return { matches, controls };
}
