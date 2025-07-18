import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users, Warehouse, Briefcase, Sun, CalendarOff, Car, Thermometer } from "lucide-react";
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
  date: Date;
  onDateSelect: (date: Date) => void;
}

export const PersonalCalendar: React.FC<PersonalCalendarProps> = ({
  date,
  onDateSelect,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null); // State for selected department

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
    removeAvailability,
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
    return assignments.filter(assignment => {
      const startDate = new Date(assignment.job.start_time);
      const endDate = new Date(assignment.job.end_time);
      // Check if the current day is the start date or within the job's span
      return isSameDay(day, startDate) || isWithinInterval(day, { start: startDate, end: endDate });
    });
  };

  const handleAvailabilityChange = (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off', date: Date) => {
    updateAvailability(techId, status, date);
  };

  const handleAvailabilityRemove = (techId: string, date: Date) => {
    removeAvailability(techId, date);
  };

  // Personnel summary for selected date
  const getPersonnelSummary = () => {
    const targetDate = selectedDate;
    const targetAssignments = getAssignmentsForDate(targetDate);

    const departmentSummary = houseTechs.reduce((acc, tech) => {
      const dept = tech.department || 'Unknown';
      if (!acc[dept]) {
        acc[dept] = {
          total: 0,
          assignedAndAvailable: 0, // Assigned and not unavailable
          assignedButUnavailable: 0, // Assigned but unavailable
          unavailable: 0, // Total unavailable (assigned or not)
          availableAndNotInWarehouse: 0, // Available and no assignment
        };
      }
      acc[dept].total++;

      const hasAssignment = targetAssignments.some(
        assignment => assignment.technician_id === tech.id
      );
      const availabilityStatus = getAvailabilityStatus(tech.id, targetDate);
      const isUnavailable = !!availabilityStatus; // Check if any availability status exists

      if (isUnavailable) {
        acc[dept].unavailable++;
      }

      if (hasAssignment) {
        if (!isUnavailable) {
          acc[dept].assignedAndAvailable++;
        } else {
          acc[dept].assignedButUnavailable++;
        }
      } else { // No assignment
        if (!isUnavailable) {
          acc[dept].availableAndNotInWarehouse++;
        }
        // If no assignment and unavailable, they are just counted in unavailable
      }

      return acc;
    }, {} as Record<string, {
      total: number;
      assignedAndAvailable: number;
      assignedButUnavailable: number;
      unavailable: number;
      availableAndNotInWarehouse: number;
    }>);

    return departmentSummary;
  };

  const personnelSummary = getPersonnelSummary();

  // Helper function to determine if tech should be shown on a given day
  const shouldShowTechOnDay = (tech: any, day: Date) => {
    // Apply department filter
    if (selectedDepartment && tech.department !== selectedDepartment) {
      return false;
    }

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

  const getPersonnelTotals = () => {
    const targetDate = selectedDate;
    const targetAssignments = getAssignmentsForDate(targetDate);

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
      const availabilityStatus = getAvailabilityStatus(tech.id, targetDate);
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
  };

  const personnelTotals = getPersonnelTotals();

  // Helper function to render badges in rows
  const renderBadgesInRows = (techs: any[], day: Date, maxPerRow: number = 5) => { // Changed maxPerRow to 5
    const visibleTechs = techs.filter(tech => shouldShowTechOnDay(tech, day));
    const dayAssignments = getAssignmentsForDate(day);
    const maxDisplay = 10; // Still limit total display for performance/UI

    // Separate technicians by department (case-insensitive and trimmed)
    const lightsTechs = visibleTechs.filter(tech => tech.department && tech.department.trim().toLowerCase() === 'lights');
    const soundTechs = visibleTechs.filter(tech => tech.department && tech.department.trim().toLowerCase() === 'sound');
    const otherTechs = visibleTechs.filter(tech => tech.department && tech.department.trim().toLowerCase() !== 'lights' && tech.department.trim().toLowerCase() !== 'sound' || !tech.department); // Include techs with no department

    // Helper to render a group of techs in rows
    const renderTechGroup = (techGroup: any[], groupKey: string) => {
      const techsToShow = techGroup.slice(0, maxDisplay); // Apply maxDisplay per group if needed, or globally

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
        {renderTechGroup(soundTechs, 'sound')} {/* Render Sound first */}
        {renderTechGroup(lightsTechs, 'lights')} {/* Then render Lights */}
        {renderTechGroup(otherTechs, 'other')}

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
      {/* Personnel Summary Section - Department View */}
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
                  selectedDepartment === department && "ring-2 ring-primary ring-inset bg-muted" // Highlight selected
                )}
                onClick={() => {
                  setSelectedDepartment(prev => prev === department ? null : department); // Toggle filter
                }}
              >
                <div className="text-sm font-medium capitalize mb-1">
                  {department}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600 font-medium">
                    Tecnicos de bolo: {stats.assignedAndAvailable} {/* Use assignedAndAvailable for "Techs out" */}
                  </span>
                  <span className="text-muted-foreground">
                    Tecnicos en Almacen: {stats.availableAndNotInWarehouse} {/* Use availableAndNotInWarehouse for "Techs in warehouse" */}
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

            {/* Personnel Totals Section - Integrated into the same grid */}
            <div className="bg-muted/30 rounded-lg p-3 col-span-1"> {/* Always col-span-1 to fit with department cards */}
              <h4 className="text-sm font-medium mb-1">Totales</h4>
              <div className="flex flex-col text-sm space-y-1">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Warehouse className="h-4 w-4" /> Tecnicos en Almacen: {personnelTotals.techsInWarehouse}
                </span>
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <Briefcase className="h-4 w-4" /> Tecnicos en bolos: {personnelTotals.techsOnJobs}
                </span>
                <span className="text-red-600 font-medium flex items-center gap-1">
                  <Sun className="h-4 w-4" /> Tecnicos de Vacaciones: {personnelTotals.techsOnVacation}
                </span>
                <span className="text-red-600 font-medium flex items-center gap-1">
                  <CalendarOff className="h-4 w-4" /> Tecnicos de Dias Libres: {personnelTotals.techsOnDaysOff}
                </span>
                <span className="text-red-600 font-medium flex items-center gap-1">
                  <Car className="h-4 w-4" /> Tecnicos en Viaje: {personnelTotals.techsTravelling}
                </span>
                <span className="text-red-600 font-medium flex items-center gap-1">
                  <Thermometer className="h-4 w-4" /> Tecnicos Enfermos: {personnelTotals.techsSick}
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
                        {renderBadgesInRows(houseTechs, day)} {/* Removed hardcoded 3 */}
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
