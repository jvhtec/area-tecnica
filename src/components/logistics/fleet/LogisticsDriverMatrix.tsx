import { useMemo, useState } from "react";
import { es } from "date-fns/locale";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  DRIVER_ASSIGNMENT_STATUS_LABELS,
  buildDayKeys,
  countUncoveredTransportsByDay,
  driverDisplayName,
  findDoubleBookedAssignmentIds,
  formatTransportTime,
  groupAssignmentsByRowAndDay,
  startOfMadridWeek,
  transportEventTitle,
  vehicleTypeLabel,
  type DriverAssignment,
  type LogisticsMatrixData,
} from "@/features/logistics/fleet/fleetModel";
import { useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";
import { getErrorMessage } from "@/utils/errorMessage";
import { addMadridCalendarDays, formatMadridDateKey, formatMadridDayKey, isMadridWeekend } from "@/utils/timezoneUtils";

import { DriverDayDialog, type MatrixRowTarget } from "./DriverDayDialog";
import { assignmentStatusClass } from "./matrixStyles";

type MatrixMode = "drivers" | "vehicles";

type MatrixRow = { id: string; label: string; detail: string; target: MatrixRowTarget };

const buildRows = (data: LogisticsMatrixData, mode: MatrixMode, assignments: DriverAssignment[]): MatrixRow[] => {
  if (mode === "drivers") {
    return data.drivers.map((driver) => ({
      id: driver.id,
      label: driverDisplayName(driver),
      detail: driver.license_categories.length > 0 ? `Permisos: ${driver.license_categories.join(", ")}` : "Sin permisos registrados",
      target: { kind: "driver", driver },
    }));
  }
  const inUse = new Set(assignments.map((assignment) => assignment.vehicle_id));
  return data.vehicles
    .filter((vehicle) => vehicle.is_active || inUse.has(vehicle.id))
    .map((vehicle) => ({
      id: vehicle.id,
      label: vehicle.name,
      detail: `${vehicle.license_plate} · ${vehicleTypeLabel(vehicle.vehicle_type)}${vehicle.is_active ? "" : " · inactivo"}`,
      target: { kind: "vehicle", vehicle },
    }));
};

export function LogisticsDriverMatrix({ readOnly }: { readOnly: boolean }) {
  const isMobile = useIsMobile();
  const todayKey = formatMadridDateKey(new Date());
  // On a phone only a couple of days fit, so start at today rather than Monday.
  const homeKey = isMobile ? todayKey : startOfMadridWeek(todayKey);
  const [startKey, setStartKey] = useState(homeKey);
  const [span, setSpan] = useState<7 | 14>(7);
  const [mode, setMode] = useState<MatrixMode>("drivers");
  const [selected, setSelected] = useState<{ row: MatrixRow; dayKey: string } | null>(null);

  const endKey = addMadridCalendarDays(startKey, span - 1);
  const dayKeys = useMemo(() => buildDayKeys(startKey, endKey), [startKey, endKey]);
  const { data, isLoading, error } = useLogisticsMatrix(startKey, endKey);

  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments]);
  const eventsById = useMemo(() => new Map((data?.events ?? []).map((event) => [event.id, event])), [data?.events]);
  const eventTimezones = useMemo(
    () => new Map((data?.events ?? []).map((event) => [event.id, event.timezone])),
    [data?.events],
  );
  const grouped = useMemo(
    () => groupAssignmentsByRowAndDay(
      assignments,
      mode === "drivers" ? "driver_id" : "vehicle_id",
      eventTimezones,
    ),
    [assignments, eventTimezones, mode],
  );
  const doubleBooked = useMemo(() => findDoubleBookedAssignmentIds(assignments), [assignments]);
  const uncovered = useMemo(() => countUncoveredTransportsByDay(data?.events ?? [], assignments), [data?.events, assignments]);
  const rows = useMemo(() => (data ? buildRows(data, mode, assignments) : []), [data, mode, assignments]);
  const driversById = useMemo(() => new Map((data?.drivers ?? []).map((driver) => [driver.id, driver])), [data?.drivers]);
  const vehiclesById = useMemo(() => new Map((data?.vehicles ?? []).map((vehicle) => [vehicle.id, vehicle])), [data?.vehicles]);

  const chipSubtitle = (assignment: DriverAssignment): string | null => {
    if (mode === "drivers") {
      const vehicle = assignment.vehicle_id ? vehiclesById.get(assignment.vehicle_id) : null;
      return vehicle ? vehicle.name : null;
    }
    const driver = assignment.driver_id ? driversById.get(assignment.driver_id) : null;
    return driver ? driverDisplayName(driver) : "Sin conductor";
  };

  const selectedAssignments = selected ? grouped.get(selected.row.id)?.get(selected.dayKey) ?? [] : [];

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Semana anterior" onClick={() => setStartKey(addMadridCalendarDays(startKey, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setStartKey(homeKey)}>Hoy</Button>
          <Button variant="outline" size="icon" aria-label="Semana siguiente" onClick={() => setStartKey(addMadridCalendarDays(startKey, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">
            {formatMadridDayKey(startKey, "d MMM", { locale: es })} – {formatMadridDayKey(endKey, "d MMM yyyy", { locale: es })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" value={mode} onValueChange={(value) => value && setMode(value as MatrixMode)} size="sm" variant="outline">
            <ToggleGroupItem value="drivers">Conductores</ToggleGroupItem>
            <ToggleGroupItem value="vehicles">Vehículos</ToggleGroupItem>
          </ToggleGroup>
          <Select value={String(span)} onValueChange={(value) => setSpan(value === "14" ? 14 : 7)}>
            <SelectTrigger className="w-[130px]" aria-label="Días visibles">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 días</SelectItem>
              <SelectItem value="14">14 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(["assigned", "confirmed", "declined"] as const).map((status) => (
          <Badge key={status} variant="outline" className={assignmentStatusClass(status)}>
            {DRIVER_ASSIGNMENT_STATUS_LABELS[status]}
          </Badge>
        ))}
        <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-300">
          <AlertTriangle className="mr-1 h-3 w-3" /> Solapado
        </Badge>
      </div>

      {error ? (
        <Card><CardContent className="py-8 text-center text-sm text-destructive">{getErrorMessage(error)}</CardContent></Card>
      ) : isLoading || !data ? (
        <Card><CardContent className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {mode === "drivers"
              ? "No hay conductores. Asigna el rol «Conductor» a un usuario desde Ajustes."
              : "No hay vehículos en la flota. Añádelos desde la pestaña Flota."}
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-full overflow-x-auto rounded-md border">
          <table className="w-full border-collapse text-sm sm:min-w-[720px]">
            <thead>
              <tr className="bg-muted/50">
                <th scope="col" className="sticky left-0 z-10 w-28 min-w-28 border-b border-r bg-muted p-2 text-left font-medium sm:w-44 sm:min-w-44">
                  {mode === "drivers" ? "Conductor" : "Vehículo"}
                </th>
                {dayKeys.map((dayKey) => {
                  const pending = uncovered.get(dayKey) ?? 0;
                  return (
                    <th
                      key={dayKey}
                      scope="col"
                      className={cn(
                        "min-w-28 border-b border-r p-2 text-left align-top font-medium sm:min-w-32",
                        isMadridWeekend(dayKey) && "bg-muted",
                        dayKey === todayKey && "bg-primary/10",
                      )}
                    >
                      <span className="block capitalize">{formatMadridDayKey(dayKey, "EEE d", { locale: es })}</span>
                      {pending > 0 && (
                        <span className="mt-1 block text-xs font-normal text-amber-700 dark:text-amber-400">
                          {pending} sin conductor
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-r bg-background p-2 text-left align-top font-normal">
                    <span className="block break-words font-medium">{row.label}</span>
                    <span className="block text-xs text-muted-foreground">{row.detail}</span>
                  </th>
                  {dayKeys.map((dayKey) => {
                    const cellAssignments = grouped.get(row.id)?.get(dayKey) ?? [];
                    return (
                      <td key={dayKey} className={cn("border-b border-r p-1 align-top", isMadridWeekend(dayKey) && "bg-muted/40")}>
                        <button
                          type="button"
                          className="flex min-h-14 w-full flex-col gap-1 rounded p-1 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`${row.label}, ${formatMadridDayKey(dayKey, "EEEE d 'de' MMMM", { locale: es })}: ${cellAssignments.length} asignaciones`}
                          onClick={() => setSelected({ row, dayKey })}
                        >
                          {cellAssignments.map((assignment) => {
                            const event = eventsById.get(assignment.logistics_event_id);
                            const subtitle = chipSubtitle(assignment);
                            return (
                              <span
                                key={assignment.id}
                                className={cn(
                                  "block rounded border px-1.5 py-1 text-xs leading-tight",
                                  assignmentStatusClass(assignment.status),
                                  doubleBooked.has(assignment.id) && "ring-2 ring-red-500",
                                )}
                              >
                                <span className="font-semibold">{formatTransportTime(assignment.starts_at, event?.timezone)}</span>{" "}
                                {event ? transportEventTitle(event) : "Transporte"}
                                {subtitle && <span className="block opacity-80">{subtitle}</span>}
                              </span>
                            );
                          })}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && data && (
        <DriverDayDialog
          open
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          dayKey={selected.dayKey}
          row={selected.row.target}
          data={data}
          rowAssignments={selectedAssignments}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
