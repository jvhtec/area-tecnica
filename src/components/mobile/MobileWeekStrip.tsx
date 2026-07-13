import React, { useMemo } from "react";
import { addDays, format, isSameDay, isToday, startOfWeek, subDays } from "date-fns";
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
 * One-week day picker: seven tall day pills (Mon–Sun) with big numerals,
 * chevrons to jump a week, accent-filled selection and a ring on today.
 * Every target is ≥44px on the tap axis.
 */
export const MobileWeekStrip: React.FC<MobileWeekStripProps> = ({
  selectedDate,
  onSelect,
  accent = "default",
}) => {
  const a = getMobileAccent(accent);

  const days = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [selectedDate]);

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

      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
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
                "flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition-all active:scale-95",
                selected
                  ? cn("shadow-md", a.fill)
                  : cn(
                      "bg-card text-foreground hover:bg-accent",
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
              <span className="text-lg font-extrabold leading-none">
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
