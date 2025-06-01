import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addDays,
  subDays,
  isToday,
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
  const [availabilityOverrides, setAvailabilityOverrides] = useState<Record<string, 'vacation' | 'travel' | 'sick'>>({});
  const { toast } = useToast();
  
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

  console.log('PersonalCalendar: Render state', { 
    isLoading, 
    houseTechsCount: houseTechs.length, 
    assignmentsCount: assignments.length 
  });

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

  const handleAvailabilityChange = (techId: string, status: 'vacation' | 'travel' | 'sick', date: Date) => {
    const dateKey = `${techId}-${format(date, 'yyyy-MM-dd')}`;
    setAvailabilityOverrides(prev => ({
      ...prev,
      [dateKey]: status
    }));

    // Show toast notification
    const statusText = status === 'vacation' ? 'vacation' : status === 'travel' ? 'travel' : 'sick day';
    toast({
      title: "Availability Updated",
      description: `Technician marked as ${statusText} for ${format(date, 'MMM d, yyyy')}`,
    });
  };

  const getAvailabilityStatus = (techId: string, date: Date): 'vacation' | 'travel' | 'sick' | null => {
    const dateKey = `${techId}-${format(date, 'yyyy-MM-dd')}`;
    return availabilityOverrides[dateKey] || null;
  };

  // Personnel for Today section logic
  const getTodayPersonnelSummary = () => {
    const today = new Date();
    const todayAssignments = getAssignmentsForDate(today);
    
    const departmentSummary = houseTechs.reduce((acc, tech) => {
      const dept = tech.department || 'Unknown';
      if (!acc[dept]) {
        acc[dept] = { total: 0, assigned: 0 };
      }
      acc[dept].total++;
      
      // Check if tech has assignment today or is unavailable
      const hasAssignment = todayAssignments.some(
        assignment => assignment.technician_id === tech.id
      );
      const isUnavailable = getAvailabilityStatus(tech.id, today);
      
      if (hasAssignment && !isUnavailable) {
        acc[dept].assigned++;
      }
      
      return acc;
    }, {} as Record<string, { total: number; assigned: number }>);

    return departmentSummary;
  };

  const personnelSummary = getTodayPersonnelSummary();

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardContent className="flex-grow p-4 flex items-center justify-center">
          <div className="text-muted-foreground">Loading calendar...</div>
        </CardContent>
      </Card>
    );
  }

  // Show message if no house techs are found
  if (houseTechs.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardContent className="flex-grow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
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
            </div>
          </div>
          <div className="text-center text-muted-foreground">
            <p>No house technicians found.</p>
            <p className="text-sm mt-2">Make sure there are users with the 'house_tech' role in the system.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Personnel for Today Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Personnel for Today</h3>
            <span className="text-sm text-muted-foreground">
              ({format(new Date(), 'MMM d, yyyy')})
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Object.entries(personnelSummary).map(([department, stats]) => (
              <div key={department} className="bg-muted/30 rounded-lg p-3">
                <div className="text-sm font-medium capitalize mb-1">
                  {department}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 font-medium">
                    In: {stats.assigned}
                  </span>
                  <span className="text-muted-foreground">
                    Out: {stats.total - stats.assigned}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Total: {stats.total}
                </div>
              </div>
            ))}
            
            {Object.keys(personnelSummary).length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-4">
                No personnel data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Calendar Section */}
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
                  const today = isToday(day);
                  
                  return (
                    <div
                      key={i}
                      className={cn(
                        "p-2 min-h-[140px] border-t relative cursor-pointer hover:bg-accent/50 transition-colors",
                        weekend ? "bg-slate-50 dark:bg-slate-800/50" : "bg-background",
                        today && "ring-2 ring-primary ring-inset",
                        !isCurrentMonth && "text-muted-foreground/50"
                      )}
                      onClick={() => onDateSelect(day)}
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        today && "text-primary font-bold"
                      )}>
                        {format(day, "d")}
                      </span>
                      
                      {/* House tech badges - smaller and more compact */}
                      <div className="mt-1 space-y-0.5">
                        {houseTechs.slice(0, 10).map((tech) => {
                          const techAssignment = dayAssignments.find(
                            assignment => assignment.technician_id === tech.id
                          );
                          const availabilityStatus = getAvailabilityStatus(tech.id, day);
                          
                          return (
                            <HouseTechBadge
                              key={tech.id}
                              technician={tech}
                              assignment={techAssignment}
                              date={day}
                              compact={true}
                              availabilityStatus={availabilityStatus}
                              onAvailabilityChange={handleAvailabilityChange}
                            />
                          );
                        })}
                        
                        {houseTechs.length > 10 && (
                          <div className="text-xs text-muted-foreground bg-accent/30 p-0.5 rounded text-center">
                            +{houseTechs.length - 10}
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
    </div>
  );
};
