import { useMemo } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FestivalStageOption } from "@/features/festival-management/types";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";

import {
  buildDayBoard,
  departmentStripe,
  lanePrefill,
  shiftAriaLabel,
  shiftCrewNames,
  summarizeCrew,
  type BoardLaneMode,
} from "./boardModel";
import {
  formatShiftDuration,
  formatShiftTime,
  shiftDepartmentLabel,
  shiftDurationMinutes,
  shiftNextDayNote,
  type ShiftFormValues,
} from "./shiftModel";

interface ShiftAgendaProps {
  shifts: readonly ShiftWithAssignments[];
  stageOptions: readonly FestivalStageOption[];
  dayStartTime: string;
  laneBy: BoardLaneMode;
  isViewOnly?: boolean;
  onOpenShift: (shiftId: string) => void;
  onCreateShift: (prefill: Partial<ShiftFormValues>) => void;
}

/** The phone version of the day board: the same lanes as sections, the shifts in day order. */
export const ShiftAgenda = ({
  shifts,
  stageOptions,
  dayStartTime,
  laneBy,
  isViewOnly = false,
  onOpenShift,
  onCreateShift,
}: ShiftAgendaProps) => {
  const { lanes } = useMemo(
    () => buildDayBoard({ shifts, dayStartTime, laneBy, stageOptions }),
    [shifts, dayStartTime, laneBy, stageOptions],
  );
  // Sections without shifts are only worth showing when a shift can be started in them.
  const visibleLanes = lanes.filter((lane) => lane.items.length > 0 || !isViewOnly);

  return (
    <div className="space-y-5" data-testid="shift-agenda">
      {visibleLanes.map((lane) => (
        <section key={lane.key} aria-label={lane.label} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{lane.label}</h3>
            {!isViewOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                aria-label={`Añadir turno en ${lane.label}`}
                onClick={() => onCreateShift(lanePrefill(lane))}
              >
                <Plus className="mr-1 h-4 w-4" />
                Añadir
              </Button>
            )}
          </div>
          {lane.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin turnos.</p>
          ) : (
            <ul className="space-y-2">
              {[...lane.items]
                .sort((a, b) => a.start - b.start || a.end - b.end)
                .map(({ shift }) => {
                  const names = shiftCrewNames(shift);
                  const nextDay = shiftNextDayNote(shift.start_time, shift.end_time, dayStartTime);
                  return (
                    <li key={shift.id}>
                      <button
                        type="button"
                        aria-label={shiftAriaLabel(shift)}
                        onClick={() => onOpenShift(shift.id)}
                        className={cn(
                          "w-full rounded-md border border-l-4 bg-card p-3 text-left shadow-sm",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          departmentStripe(shift.department),
                        )}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-medium">{shift.name}</span>
                          {nextDay && (
                            <Badge variant="outline" title={nextDay}>
                              +1 día
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">
                          {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)} ·{" "}
                          {formatShiftDuration(shiftDurationMinutes(shift.start_time, shift.end_time))}
                          {laneBy === "stage" && shift.department ? ` · ${shiftDepartmentLabel(shift.department)}` : ""}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block text-sm",
                            names.length === 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground/80",
                          )}
                        >
                          {names.length === 0 ? "Sin personal" : summarizeCrew(names, 4)}
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
};
