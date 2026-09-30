import { useEffect, useMemo, useRef } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FestivalStageOption } from "@/features/festival-management/types";
import type { ShiftWithAssignments } from "@/types/festival-scheduling";

import {
  buildDayBoard,
  lanePrefill,
  shiftCrewNames,
  shiftTimesFromBoardClick,
  summarizeCrew,
  BOARD_HOUR_PX,
  BOARD_MIN_BLOCK_PX,
  departmentStripe,
  shiftAriaLabel,
  type BoardItem,
  type BoardLane,
  type BoardLaneMode,
} from "./boardModel";
import {
  formatShiftDuration,
  formatShiftTime,
  shiftDurationMinutes,
  shiftNextDayNote,
  type ShiftFormValues,
} from "./shiftModel";

const GUTTER = "3.5rem";

interface ShiftBoardProps {
  shifts: readonly ShiftWithAssignments[];
  stageOptions: readonly FestivalStageOption[];
  dayStartTime: string;
  laneBy: BoardLaneMode;
  isViewOnly?: boolean;
  /** Changes when the board is showing another day, so it scrolls to that day's first shift. */
  scrollKey: string;
  onOpenShift: (shiftId: string) => void;
  onCreateShift: (prefill: Partial<ShiftFormValues>) => void;
}

/** One festival day as a timeline: a column per stage (or department), a block per shift. */
export const ShiftBoard = ({
  shifts,
  stageOptions,
  dayStartTime,
  laneBy,
  isViewOnly = false,
  scrollKey,
  onOpenShift,
  onCreateShift,
}: ShiftBoardProps) => {
  const { lanes, hours } = useMemo(
    () => buildDayBoard({ shifts, dayStartTime, laneBy, stageOptions }),
    [shifts, dayStartTime, laneBy, stageOptions],
  );
  const firstStart = useMemo(() => Math.min(...lanes.flatMap((lane) => lane.items.map((item) => item.start)), Infinity), [lanes]);

  // Land on the day's first shift instead of the top of an empty night, once per day shown.
  const scroller = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!scroller.current || scrolledFor.current === scrollKey || !Number.isFinite(firstStart)) return;
    scrolledFor.current = scrollKey;
    scroller.current.scrollTop = Math.max(0, (firstStart / 60) * BOARD_HOUR_PX - BOARD_HOUR_PX / 2);
  }, [scrollKey, firstStart]);

  const height = 24 * BOARD_HOUR_PX;

  const handleLaneClick = (event: React.MouseEvent<HTMLDivElement>, lane: BoardLane) => {
    if (isViewOnly || event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = ((event.clientY - rect.top) / BOARD_HOUR_PX) * 60;
    onCreateShift({ ...shiftTimesFromBoardClick(offset, dayStartTime), ...lanePrefill(lane) });
  };

  return (
    <div className="rounded-md border" data-testid="shift-board">
      <div ref={scroller} className="max-h-[70vh] overflow-auto">
        <div
          className="grid min-w-fit"
          style={{ gridTemplateColumns: `${GUTTER} repeat(${lanes.length}, minmax(10rem, 1fr))` }}
        >
          <div className="sticky top-0 z-20 border-b bg-background" />
          {lanes.map((lane) => (
            <div
              key={lane.key}
              className="sticky top-0 z-20 flex items-center justify-between gap-1 border-b border-l bg-background px-2 py-2"
            >
              <h3 className="truncate text-sm font-medium">{lane.label}</h3>
              {!isViewOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  aria-label={`Añadir turno en ${lane.label}`}
                  onClick={() => onCreateShift(lanePrefill(lane))}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="relative" style={{ height }} aria-hidden="true">
            {hours.map((mark) => (
              <span
                key={mark.offset}
                className="absolute right-1 -translate-y-1/2 text-xs leading-none text-muted-foreground"
                style={{ top: (mark.offset / 60) * BOARD_HOUR_PX }}
              >
                {mark.label}
              </span>
            ))}
          </div>

          {lanes.map((lane) => (
            <div
              key={lane.key}
              role="group"
              aria-label={lane.label}
              className={cn("relative border-l", !isViewOnly && "cursor-cell")}
              style={{ height }}
              onClick={(event) => handleLaneClick(event, lane)}
            >
              {hours.map((mark) => (
                <div
                  key={mark.offset}
                  className="pointer-events-none absolute inset-x-0 border-t border-border/50"
                  style={{ top: (mark.offset / 60) * BOARD_HOUR_PX }}
                />
              ))}
              {lane.items.map((item) => (
                <ShiftBlock key={item.shift.id} item={item} dayStartTime={dayStartTime} onOpen={onOpenShift} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ShiftBlock = ({
  item,
  dayStartTime,
  onOpen,
}: {
  item: BoardItem;
  dayStartTime: string;
  onOpen: (shiftId: string) => void;
}) => {
  const { shift } = item;
  const end = Math.min(item.end, 24 * 60);
  const top = (item.start / 60) * BOARD_HOUR_PX;
  const height = Math.max(((end - item.start) / 60) * BOARD_HOUR_PX, BOARD_MIN_BLOCK_PX);
  const names = shiftCrewNames(shift);
  const nextDay = shiftNextDayNote(shift.start_time, shift.end_time, dayStartTime);

  return (
    <button
      type="button"
      aria-label={shiftAriaLabel(shift)}
      title={nextDay ?? undefined}
      onClick={() => onOpen(shift.id)}
      className={cn(
        "absolute overflow-hidden rounded-md border border-l-4 bg-card px-1.5 py-1 text-left text-xs shadow-sm",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        departmentStripe(shift.department),
        item.clipped && "rounded-b-none",
        names.length === 0 && "bg-amber-50 dark:bg-amber-950/30",
      )}
      style={{
        top,
        height,
        left: `calc(${(item.column / item.columns) * 100}% + 2px)`,
        width: `calc(${100 / item.columns}% - 4px)`,
      }}
    >
      <span className="block truncate font-medium">{shift.name}</span>
      <span className="block truncate text-muted-foreground">
        {formatShiftTime(shift.start_time)}–{formatShiftTime(shift.end_time)}
        {nextDay ? " · +1 día" : ""}
        {height >= 60 ? ` · ${formatShiftDuration(shiftDurationMinutes(shift.start_time, shift.end_time))}` : ""}
      </span>
      {height >= 46 && (
        <span className={cn("block truncate", names.length === 0 ? "text-amber-700 dark:text-amber-400" : "text-foreground/80")}>
          {names.length === 0 ? "Sin personal" : summarizeCrew(names)}
        </span>
      )}
    </button>
  );
};
