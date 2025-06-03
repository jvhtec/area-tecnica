import React, { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users, Volume2, Lightbulb } from "lucide-react";
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
  isWithinInterval,
} from "date-fns";
import { cn } from "@/lib/utils";
import { HouseTechBadge } from "./HouseTechBadge";
import { usePersonalCalendarData } from "./hooks/usePersonalCalendarData";
import { useTechnicianAvailability } from "./hooks/useTechnicianAvailability";

interface PersonalCalendarProps {
  initialDate?: Date;
  onDateSelect?: (date: Date) => void;
}

export const PersonalCalendar: React.FC<PersonalCalendarProps> = ({
  initialDate = new Date(),
  onDateSelect,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  console.log('PersonalCalendar render:', { currentMonth, selectedDate });
  
  // Memoize calendar days calculation
  const allDays = useMemo(() => {
    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });

    const startDay = firstDayOfMonth.getDay();
    const paddingDays = startDay === 0 ? 6 : startDay - 1;
    const prefixDays = Array.from({ length: paddingDays }).map((_, i) => {
      return subDays(firstDayOfMonth, paddingDays - i);
    });

    const totalDaysNeeded = 42;
    const suffixDays = Array.from({
      length: totalDaysNeeded - (prefixDays.length + daysInMonth.length)
    }).map((_, i) => {
      return addDays(lastDayOfMonth, i + 1);
    });

    return [...prefixDays, ...daysInMonth, ...suffixDays];
  }, [currentMonth]);

  const { houseTechs, assignments, isLoading } = usePersonalCalendarData(currentMonth);
  const {
    updateAvailability,
    removeAvailability,
    getAvailabilityStatus,
    isLoading: isAvailabilityLoading
  } = useTechnicianAvailability(currentMonth);

  console.log('PersonalCalendar data:', { 
    houseTechsCount: houseTechs?.length || 0, 
    assignmentsCount: assignments?.length || 0, 
    isLoading, 
    isAvailabilityLoading 
  });

  // Memoize assignments lookup for performance
  const assignmentsByDate = useMemo(() => {
    const lookup = new Map<string, typeof assignments>();
    
    allDays.forEach(day => {
      const dayKey = day.toISOString().split('T')[0];
      const dayAssignments = assignments.filter(assignment => {
        const startDate = new Date(assignment.job.start_time);
        const endDate = new Date(assignment.job.end_time);
        return isSameDay(day, startDate) || isWithinInterval(day, { start: startDate, end: endDate });
      });
      lookup.set(dayKey, dayAssignments);
    });
    
    return lookup;
  }, [assignments, allDays]);

  // Memoized function to get assignments for a specific date
  const getAssignmentsForDate = useCallback((day: Date) => {
    const dayKey = day.toISOString().split('T')[0];
    return assignmentsByDate.get(dayKey) || [];
  }, [assignmentsByDate]);

  // Memoize personnel calculations
  const personnelSummary = useMemo(() => {
    const targetAssignments = getAssignmentsForDate(selectedDate);

    return houseTechs.reduce((acc, tech) => {
      const dept = tech.department || 'Unknown';
      if (!acc[dept]) {
        acc[dept] = {
          total: 0,
          assignedAndAvailable: 0,
          assignedButUnavailable: 0,
          unavailable: 0,
          availableAndNotInWarehouse: 0,
        };
      }
      acc[dept].total++;

      const hasAssignment = targetAssignments.some(
        assignment => assignment.technician_id === tech.id
      );
      const availabilityStatus = getAvailabilityStatus(tech.id, selectedDate);
      const isUnavailable = !!availabilityStatus;

      if (isUnavailable) {
        acc[dept].unavailable++;
      }

      if (hasAssignment) {
        if (!isUnavailable) {
          acc[dept].assignedAndAvailable++;
        } else {
          acc[dept].assignedButUnavailable++;
        }
      } else {
        if (!isUnavailable) {
          acc[dept].availableAndNotInWarehouse++;
        }
      }

      return acc;
    }, {} as Record<string, {
      total: number;
      assignedAndAvailable: number;
      assignedButUnavailable: number;
      unavailable: number;
      availableAndNotInWarehouse: number;
    }>);
  }, [houseTechs, selectedDate, getAssignmentsForDate, getAvailabilityStatus]);

  const personnelTotals = useMemo(() => {
    const targetAssignments = getAssignmentsForDate(selectedDate);

    let techsInWarehouse = 0;
    let techsOnJobs = 0;
    let techsOnVacation = 0;
    let techsOnDaysOff = 0;
    let techsTravelling = 0;
    let techsSick = 0;

    houseTechs.forEach(tech => {
      const hasAssignment = targetAssignments.some(
        assignment => assignment.technician_id === tech.id
      );
      const availabilityStatus = getAvailabilityStatus(tech.id, selectedDate);
      const isUnavailable = !!availabilityStatus;

      if (!hasAssignment && !isUnavailable) {
        techsInWarehouse++;
      }

      if (hasAssignment) {
        techsOnJobs++;
      }

      if (availabilityStatus === 'vacation') {
        techsOnVacation++;
      } else if (availabilityStatus === 'day_off') {
        techsOnDaysOff++;
      } else if (availabilityStatus === 'travel') {
        techsTravelling++;
      } else if (availabilityStatus === 'sick') {
        techsSick++;
      }
    });

    return {
      techsInWarehouse,
      techsOnJobs,
      techsOnVacation,
      techsOnDaysOff,
      techsTravelling,
      techsSick,
    };
  }, [houseTechs, selectedDate, getAssignmentsForDate, getAvailabilityStatus]);

  // Memoized event handlers
  const handlePreviousMonth = useCallback(() => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
    onDateSelect?.(newDate);
  }, [currentMonth, onDateSelect]);

  const handleNextMonth = useCallback(() => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
    onDateSelect?.(newDate);
  }, [currentMonth, onDateSelect]);

  const handleTodayClick = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
    onDateSelect?.(today);
  }, [onDateSelect]);

  const handleDateClick = useCallback((day: Date) => {
    setSelectedDate(day);
    // Only change month if clicking on a day from different month
    if (!isSameMonth(day, currentMonth)) {
      setCurrentMonth(day);
    }
    onDateSelect?.(day);
  }, [currentMonth, onDateSelect]);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const handleDepartmentClick = useCallback((department: string) => {
    setSelectedDepartment(prev => prev === department ? null : department);
  }, []);

  const handleAvailabilityChange = useCallback((techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off', date: Date) => {
    updateAvailability(techId, status, date);
  }, [updateAvailability]);

  const handleAvailabilityRemove = useCallback((techId: string, date: Date) => {
    removeAvailability(techId, date);
  }, [removeAvailability]);

  // Memoized utility functions
  const isWeekend = useCallback((day: Date) => {
    const dayOfWeek = day.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }, []);

  const shouldShowTechOnDay = useCallback((tech: any, day: Date) => {
    if (selectedDepartment && tech.department !== selectedDepartment) {
      return false;
    }

    const dayAssignments = getAssignmentsForDate(day);
    const hasAssignment = dayAssignments.some(
      assignment => assignment.technician_id === tech.id
    );
    const availabilityStatus = getAvailabilityStatus(tech.id, day);

    if (isWeekend(day) && !hasAssignment && !availabilityStatus) {
      return false;
    }

    return true;
  }, [selectedDepartment, getAssignmentsForDate, getAvailabilityStatus, isWeekend]);

  // Memoized badge rendering function
  const renderBadgesInRows = useCallback((techs: any[], day: Date, maxPerRow: number = 5) => {
    const visibleTechs = techs.filter(tech => shouldShowTechOnDay(tech, day));
    const dayAssignments = getAssignmentsForDate(day);
    const maxDisplay = 10;

    const lightsTechs = visibleTechs.filter(tech => tech.department && tech.department.trim().toLowerCase() === 'lights');
    const soundTechs = visibleTechs.filter(tech => tech.department && tech.department.trim().toLowerCase() === 'sound');
    const otherTechs = visibleTechs.filter(tech => tech.department && tech.department.trim().toLowerCase() !== 'lights' && tech.department.trim().toLowerCase() !== 'sound' || !tech.department);

    const renderTechGroup = (techGroup: any[], groupKey: string) => {
      const techsToShow = techGroup.slice(0, maxDisplay);
      const rows = [];
      for (let i = 0; i < techsToShow.length; i += maxPerRow) {
        rows.push(techsToShow.slice(i, i + maxPerRow));
      }

      return (
        <div key={groupKey}>
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
                    onAvailabilityRemove={handleAvailabilityRemove}
                  />
                );
              })}
            </div>
          ))}
        </div>
      );
    };

    return (
      <>
        {renderTechGroup(soundTechs, 'sound')}
        {renderTechGroup(lightsTechs, 'lights')}
        {renderTechGroup(otherTechs, 'other')}

        {visibleTechs.length > maxDisplay && (
          <div className="text-xs text-muted-foreground bg-accent/30 p-0.5 rounded text-center mt-1">
            +{visibleTechs.length - maxDisplay}
          </div>
        )}
      </>
    );
  }, [shouldShowTechOnDay, getAssignmentsForDate, getAvailabilityStatus, handleAvailabilityChange, handleAvailabilityRemove]);

  if (isLoading || isAvailabilityLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardContent className="flex-grow p-4 flex items-center justify-center">
          <div className="text-muted-foreground">Loading calendar...</div>
        </CardContent>
      </Card>
    );
  }

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
      {/* Personnel Summary Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Sumario de Personal</h3>
            <span className="text-sm text-muted-foreground">
              ({format(selectedDate, 'MMM d, yyyy')})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Object.entries(personnelSummary).map(([department, stats]) => (
              <div
                key={department}
                className={cn(
                  "bg-muted/30 rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted",
                  selectedDepartment === department && "ring-2 ring-primary ring-inset bg-muted"
                )}
                onClick={() => handleDepartmentClick(department)}
              >
                <div className="text-sm font-medium capitalize mb-1">
                  {department}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 font-medium">
                    Tecnicos de bolo: {stats.assignedAndAvailable}
                  </span>
                  <span className="text-muted-foreground">
                    Tecnicos en Almacen: {stats.availableAndNotInWarehouse}
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

            <div className="bg-muted/30 rounded-lg p-3 col-span-1">
              <h4 className="text-sm font-medium mb-1">Totales</h4>
              <div className="flex flex-col text-sm space-y-1">
                <span className="text-muted-foreground">
                  Tecnicos en Almacen: {personnelTotals.techsInWarehouse}
                </span>
                <span className="text-green-600 font-medium">
                  Tecnicos en bolos: {personnelTotals.techsOnJobs}
                </span>
                <span className="text-red-600 font-medium">
                  Tecnicos de Vacaciones: {personnelTotals.techsOnVacation}
                </span>
                <span className="text-red-600 font-medium">
                  Tecnicos de Dias Libres: {personnelTotals.techsOnDaysOff}
                </span>
                <span className="text-red-600 font-medium">
                  Tecnicos en Viaje: {personnelTotals.techsTravelling}
                </span>
                <span className="text-red-600 font-medium">
                  Tecnicos Enfermos: {personnelTotals.techsSick}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Total Tecnicos: {houseTechs.length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Section */}
      <Card className="h-full flex flex-col">
        <CardContent className="flex-grow p-4">
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
              <Button variant="ghost" size="icon" onClick={handleToggleCollapse}>
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {!isCollapsed && (
            <div className="border rounded-lg overflow-x-auto">
              <div className="grid grid-cols-7 gap-px bg-muted" style={{ minWidth: "980px" }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="bg-background p-2 text-center text-sm text-muted-foreground font-medium">
                    {day}
                  </div>
                ))}

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

                      <div className="mt-1 overflow-hidden">
                        {renderBadgesInRows(houseTechs, day)}
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