
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addDays,
  subDays,
  isToday,
  isSameDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { HouseTechBadge } from "./HouseTechBadge";
import { usePersonalCalendarData } from "./hooks/usePersonalCalendarData";
import { useTechnicianAvailability } from "./hooks/useTechnicianAvailability";

interface PersonalCalendarProps {
  date: Date;
  onDateSelect: (date: Date) => void;
}

export const PersonalCalendar: React.FC<PersonalCalendarProps> = ({
  date,
  onDateSelect,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
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
  const { 
    updateAvailability, 
    getAvailabilityStatus,
    isLoading: isAvailabilityLoading 
  } = useTechnicianAvailability(currentMonth);

  console.log('PersonalCalendar: Render state', { 
    isLoading, 
    isAvailabilityLoading,
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
    const today = new Date();
    onDateSelect(today);
    setSelectedDate(today);
  };

  const handleDateClick = (day: Date) => {
    onDateSelect(day);
    setSelectedDate(day);
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
    updateAvailability(techId, status, date);
  };

  // Personnel summary for selected date
  const getPersonnelSummary = () => {
    const targetDate = selectedDate;
    const targetAssignments = getAssignmentsForDate(targetDate);
    
    const departmentSummary = houseTechs.reduce((acc, tech) => {
      const dept = tech.department || 'Unknown';
      if (!acc[dept]) {
        acc[dept] = { total: 0, assigned: 0 };
      }
      acc[dept].total++;
      
      // Check if tech has assignment on target date or is unavailable
      const hasAssignment = targetAssignments.some(
        assignment => assignment.technician_id === tech.id
      );
      const isUnavailable = getAvailabilityStatus(tech.id, targetDate);
      
      if (hasAssignment && !isUnavailable) {
        acc[dept].assigned++;
      }
      
      return acc;
    }, {} as Record<string, { total: number; assigned: number }>);

    return departmentSummary;
  };

  const personnelSummary = getPersonnelSummary();

  // Helper function to determine if tech should be shown on a given day
  const shouldShowTechOnDay = (tech: any, day: Date) => {
    const dayAssignments = getAssignmentsForDate(day);
    const hasAssignment = dayAssignments.some(
      assignment => assignment.technician_id === tech.id
    );
    const availabilityStatus = getAvailabilityStatus(tech.id, day);
    
    // If it's a weekend and no assignment and not marked unavailable, don't show
    if (isWeekend(day) && !hasAssignment && !availabilityStatus) {
      return false;
    }
    
    return true;
  };

  // Helper function to render badges in rows
  const renderBadgesInRows = (techs: any[], day: Date, maxPerRow: number = 3) => {
    const visibleTechs = techs.filter(tech => shouldShowTechOnDay(tech, day));
    const dayAssignments = getAssignmentsForDate(day);
    const maxDisplay = 10;
    const techsToShow = visibleTechs.slice(0, maxDisplay);
    
    // Group techs into rows
    const rows = [];
    for (let i = 0; i < techsToShow.length; i += maxPerRow) {
      rows.push(techsToShow.slice(i, i + maxPerRow));
    }
    
    return (
      <>
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1 mb-1">
            {row.map((tech) => {
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
          </div>
        ))}
        
        {visibleTechs.length > maxDisplay && (
          <div className="text-xs text-muted-foreground bg-accent/30 p-0.5 rounded text-center mt-1">
            +{visibleTechs.length - maxDisplay}
          </div>
        )}
      </>
    );
  };

  if (isLoading || isAvailabilityLoading) {
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
      {/* Personnel Summary Section - now date-aware */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Personnel Summary</h3>
            <span className="text-sm text-muted-foreground">
              ({format(selectedDate, 'MMM d, yyyy')})
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
                    Techs out: {stats.assigned}
                  </span>
                  <span className="text-muted-foreground">
                    Techs in warehouse: {stats.total - stats.assigned}
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
                  const weekend = isWeekend(day);
                  const today = isToday(day);
                  const isSelected = isSameDay(day, selectedDate);
                  
                  return (
                    <div
                      key={i}
                      className={cn(
                        "p-2 min-h-[140px] border-t relative cursor-pointer hover:bg-accent/50 transition-colors",
                        weekend ? "bg-slate-50 dark:bg-slate-800/50" : "bg-background",
                        today && "ring-2 ring-primary ring-inset",
                        isSelected && "bg-accent/30",
                        !isCurrentMonth && "text-muted-foreground/50"
                      )}
                      onClick={() => handleDateClick(day)}
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        today && "text-primary font-bold",
                        isSelected && "text-primary"
                      )}>
                        {format(day, "d")}
                      </span>
                      
                      {/* House tech badges - now in rows */}
                      <div className="mt-1">
                        {renderBadgesInRows(houseTechs, day, 3)}
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
