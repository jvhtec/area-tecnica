
import React from "react";
import { format, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarJobCard } from "./CalendarJobCard";

interface CalendarGridProps {
  allDays: Date[];
  currentMonth: Date;
  getJobsForDate: (date: Date) => any[];
  onDateSelect: (date: Date) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  allDays,
  currentMonth,
  getJobsForDate,
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
          const maxVisibleJobs = 7;
          return (
            <div
              key={i}
              className={cn(
                "bg-background p-2 min-h-[200px] border-t relative cursor-pointer hover:bg-accent/50 transition-colors calendar-cell",
                !isCurrentMonth && "text-muted-foreground/50"
              )}
              onClick={() => onDateSelect(day)}
            >
              <span className="text-sm">{format(day, "d")}</span>
              <div className="space-y-1 mt-1 calendar-job-list">
                {dayJobs.slice(0, maxVisibleJobs).map((job: any) => (
                  <CalendarJobCard key={job.id} job={job} date={day} />
                ))}
                {dayJobs.length > maxVisibleJobs && (
                  <div className="text-xs text-muted-foreground mt-1 bg-accent/30 p-1 rounded text-center">
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
