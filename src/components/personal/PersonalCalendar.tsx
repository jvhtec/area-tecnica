
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addDays,
  subDays,
} from "date-fns";
import { cn } from "@/lib/utils";
import { HouseTechBadge } from "./HouseTechBadge";
import { usePersonalCalendarData } from "./hooks/usePersonalCalendarData";

interface PersonalCalendarProps {
  date: Date;
  onDateSelect: (date: Date) => void;
}

export const PersonalCalendar: React.FC<PersonalCalendarProps> = ({
  date,
  onDateSelect,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const currentMonth = date;
  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  
  // Get calendar padding for full weeks
  const startDay = firstDayOfMonth.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1; // Monday = 0
  const prefixDays = Array.from({ length: paddingDays }).map((_, i) => {
    return subDays(firstDayOfMonth, paddingDays - i);
  });
  
  const totalDaysNeeded = 42; // 6 weeks
  const suffixDays = Array.from({ 
    length: totalDaysNeeded - (prefixDays.length + daysInMonth.length) 
  }).map((_, i) => {
    return addDays(lastDayOfMonth, i + 1);
  });
  
  const allDays = [...prefixDays, ...daysInMonth, ...suffixDays];
  
  const { houseTechs, assignments, isLoading } = usePersonalCalendarData(currentMonth);

  const handlePreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateSelect(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateSelect(newDate);
  };

  const handleTodayClick = () => {
    onDateSelect(new Date());
  };

  const isWeekend = (day: Date) => {
    const dayOfWeek = day.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  };

  const getAssignmentsForDate = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return assignments.filter(assignment => {
      const jobDate = format(new Date(assignment.job.start_time), 'yyyy-MM-dd');
      return jobDate === dateStr;
    });
  };

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardContent className="flex-grow p-4 flex items-center justify-center">
          <div className="text-muted-foreground">Loading calendar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-grow p-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleTodayClick}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="border rounded-lg overflow-x-auto">
            <div className="grid grid-cols-7 gap-px bg-muted" style={{ minWidth: "980px" }}>
              {/* Days of week header */}
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <div key={day} className="bg-background p-2 text-center text-sm text-muted-foreground font-medium">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {allDays.map((day, i) => {
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const dayAssignments = getAssignmentsForDate(day);
                const weekend = isWeekend(day);
                
                return (
                  <div
                    key={i}
                    className={cn(
                      "p-2 min-h-[120px] border-t relative cursor-pointer hover:bg-accent/50 transition-colors",
                      weekend ? "bg-slate-50 dark:bg-slate-800/50" : "bg-background",
                      !isCurrentMonth && "text-muted-foreground/50"
                    )}
                    onClick={() => onDateSelect(day)}
                  >
                    <span className="text-sm font-medium">{format(day, "d")}</span>
                    
                    {/* House tech badges */}
                    <div className="mt-2 space-y-1">
                      {houseTechs.slice(0, 6).map((tech) => {
                        const techAssignment = dayAssignments.find(
                          assignment => assignment.technician_id === tech.id
                        );
                        
                        return (
                          <HouseTechBadge
                            key={tech.id}
                            technician={tech}
                            assignment={techAssignment}
                            date={day}
                          />
                        );
                      })}
                      
                      {houseTechs.length > 6 && (
                        <div className="text-xs text-muted-foreground bg-accent/30 p-1 rounded text-center">
                          +{houseTechs.length - 6} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
