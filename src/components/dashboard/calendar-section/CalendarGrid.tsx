import React from "react";
import { format, isSameMonth, isToday } from "date-fns";

import { cn } from "@/lib/utils";

export interface CalendarGridProps {
  allDays: Date[];
  currentMonth: Date;
  getJobsForDate: (date: Date) => any[];
  renderJobCard: (job: any, date: Date) => JSX.Element;
  onDateSelect: (date: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  allDays,
  currentMonth,
  getJobsForDate,
  renderJobCard,
  onDateSelect,
}) => {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <div className="grid grid-cols-7 gap-px bg-muted" style={{ minWidth: "980px" }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="bg-background p-2 text-center text-sm text-muted-foreground font-medium">
            {day}
          </div>
        ))}
        {allDays.map((day, i) => {
          const dayJobs = getJobsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const maxVisibleJobs = 7;
          return (
            <div
              key={i}
              className={cn(
                "bg-background p-1 min-h-[120px] border-t relative cursor-pointer hover:bg-accent/50 transition-colors calendar-cell",
                isTodayDate && "ring-2 ring-inset ring-primary bg-primary/5 hover:bg-primary/10",
                !isCurrentMonth && "text-muted-foreground/50"
              )}
              aria-current={isTodayDate ? "date" : undefined}
              onClick={() => onDateSelect(day)}
            >
              <span className={cn("text-sm font-medium ml-1", isTodayDate && "text-primary")}>{format(day, "d")}</span>
              <div className="space-y-1 mt-1 calendar-job-list">
                {dayJobs.slice(0, maxVisibleJobs).map((job: any) => renderJobCard(job, day))}
                {dayJobs.length > maxVisibleJobs && (
                  <div className="text-xs text-muted-foreground mt-1 bg-accent/30 p-0.5 rounded text-center">
                    + {dayJobs.length - maxVisibleJobs} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
