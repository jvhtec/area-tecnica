import React, { useMemo } from "react";
import { addDays, differenceInCalendarDays, format, isSameDay, isToday, startOfWeek, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { getMobileAccent, type MobileAccentKey } from "./mobile-accents";

interface MobileWeekStripProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  accent?: MobileAccentKey;
}

/**
 * One-week day picker: seven tall day pills (Mon–Sun) with big numerals and
 * chevrons to jump a week. A single accent-filled pill slides between days on
 * selection (pure CSS transform, so the global reduced-motion guard applies).
 * Every target is ≥44px on the tap axis.
 */
export const MobileWeekStrip: React.FC<MobileWeekStripProps> = ({
  selectedDate,
  onSelect,
  accent = "default",
}) => {
  const a = getMobileAccent(accent);

  const weekStart = useMemo(
    () => startOfWeek(selectedDate, { weekStartsOn: 1 }),
    [selectedDate],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const selectedIndex = Math.min(
    6,
    Math.max(0, differenceInCalendarDays(selectedDate, weekStart)),
  );

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Semana anterior"
        onClick={() => onSelect(subDays(selectedDate, 7))}
        className="flex h-11 w-7 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="relative grid min-w-0 flex-1 grid-cols-7 gap-1">
        {/* Sliding selection pill. Sized to one column; translateX percentages
            are relative to its own width, so each step is 100% + the 0.25rem gap. */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 rounded-2xl shadow-md transition-transform duration-300 ease-out",
            a.fill,
          )}
          style={{
            width: "calc((100% - 1.5rem) / 7)",
            transform: `translateX(calc(${selectedIndex} * (100% + 0.25rem)))`,
          }}
        />
        {days.map((day) => {
          const selected = isSameDay(day, selectedDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={format(day, "EEEE d 'de' MMMM", { locale: es })}
              aria-pressed={selected}
              className={cn(
                "relative z-10 flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors duration-300 active:scale-95",
                selected
                  ? "text-white"
                  : cn(
                      "text-foreground hover:bg-accent",
                      today && cn("ring-2 ring-inset", a.todayRing),
                    ),
              )}
            >
              <span
                className={cn(
                  "text-xs font-semibold uppercase",
                  selected ? "text-white/80" : "text-muted-foreground",
                )}
              >
                {format(day, "EEEEE", { locale: es })}
              </span>
              <span className="text-lg font-extrabold leading-none tabular-nums">
                {format(day, "d")}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Semana siguiente"
        onClick={() => onSelect(addDays(selectedDate, 7))}
        className="flex h-11 w-7 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
