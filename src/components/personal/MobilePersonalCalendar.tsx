import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Users, Warehouse, Briefcase, Sun, CalendarOff, Car, Thermometer, Printer } from "lucide-react";
import { PrintDialog, PrintSettings } from "@/components/dashboard/PrintDialog";
import { format, addDays, subDays, isToday, isSameDay, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { HouseTechBadge } from "./HouseTechBadge";
import { usePersonalCalendarData } from "./hooks/usePersonalCalendarData";
import { useTechnicianAvailability } from "./hooks/useTechnicianAvailability";

interface MobilePersonalCalendarProps {
  date: Date;
  onDateSelect: (date: Date) => void;
}

export const MobilePersonalCalendar: React.FC<MobilePersonalCalendarProps> = ({
  date,
  onDateSelect,
}) => {
  const [currentDate, setCurrentDate] = useState(date);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    jobTypes: {
      tourdate: true,
      tour: true,
      single: true,
      dryhire: true,
      festival: true,
    },
  });

  useEffect(() => {
    setCurrentDate(date);
  }, [date]);

  const { houseTechs, assignments, isLoading } = usePersonalCalendarData(currentDate);
  const {
    updateAvailability,
    removeAvailability,
    getAvailabilityStatus,
    isLoading: isAvailabilityLoading
  } = useTechnicianAvailability(currentDate);

  const getAssignmentsForDate = useCallback((targetDate: Date) => {
    return assignments.filter(assignment => {
      const startDate = new Date(assignment.job.start_time);
      const endDate = new Date(assignment.job.end_time);
      return isSameDay(targetDate, startDate) || isWithinInterval(targetDate, { start: startDate, end: endDate });
    });
  }, [assignments]);

  const currentDateAssignments = getAssignmentsForDate(currentDate);

  const navigateToPrevious = () => {
    const newDate = subDays(currentDate, 1);
    setCurrentDate(newDate);
    onDateSelect(newDate);
  };

  const navigateToNext = () => {
    const newDate = addDays(currentDate, 1);
    setCurrentDate(newDate);
    onDateSelect(newDate);
  };

  const navigateToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onDateSelect(today);
  };

  const handleAvailabilityChange = (techId: string, status: 'vacation' | 'travel' | 'sick' | 'day_off', targetDate: Date) => {
    updateAvailability(techId, status, targetDate);
  };

  const handleAvailabilityRemove = (techId: string, targetDate: Date) => {
    removeAvailability(techId, targetDate);
  };

  const isWeekend = (day: Date) => {
    const dayOfWeek = day.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  };

  const shouldShowTechOnDay = (tech: any, day: Date) => {
    // Apply department filter if selected
    if (selectedDepartment && (String(tech.department || '').trim() !== selectedDepartment)) {
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

  // Personnel summary for selected date
  const getPersonnelSummary = () => {
    const targetDate = currentDate;
    const targetAssignments = getAssignmentsForDate(targetDate);

    const departmentSummary = houseTechs.reduce((acc, tech) => {
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
      const availabilityStatus = getAvailabilityStatus(tech.id, targetDate);
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

    return departmentSummary;
  };

  const getPersonnelTotals = () => {
    const targetDate = currentDate;
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

  const personnelSummary = getPersonnelSummary();
  const personnelTotals = getPersonnelTotals();

  const visibleTechs = houseTechs.filter(tech => shouldShowTechOnDay(tech, currentDate));

  const generatePDF = (range: "month" | "quarter" | "year") => {
    console.log("Mobile house techs PDF generation not implemented for", range);
    setShowPrintDialog(false);
  };

  const generateXLS = (range: "month" | "quarter" | "year") => {
    console.log("Mobile house techs XLS generation not implemented for", range);
    setShowPrintDialog(false);
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

  if (houseTechs.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold">House Techs</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow p-4 flex flex-col items-center justify-center text-center">
          <Users className="h-8 w-8 mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">No house technicians found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Make sure there are users with the 'house_tech' role
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-[480px] mx-auto sm:max-w-lg">
      <Card className="h-full flex flex-col">
        <CardHeader className="px-2 sm:px-4 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">House Technicians</CardTitle>
          </div>
        
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={navigateToPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 mr-1" />
            <span className={cn(
              "font-medium",
              isToday(currentDate) && "text-primary"
            )}>
              {format(currentDate, "EEE, MMM d")}
            </span>
          </div>
          
          <Button variant="ghost" size="icon" onClick={navigateToNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedDepartment(null)}
            disabled={!selectedDepartment}
          >
            <Users className="h-4 w-4 mr-1" />
            {selectedDepartment ? `${selectedDepartment}` : 'All Depts'}
          </Button>
          
          <Button variant="outline" size="sm" onClick={() => setShowPrintDialog(true)}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={navigateToToday}
            className={cn(
              isToday(currentDate) && "bg-primary text-primary-foreground"
            )}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Today
          </Button>
        </div>

        {/* Personnel Summary Section - Moved to header */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Personal Summary</h4>
          </div>

          <div className="space-y-2">
            {Object.entries(personnelSummary).map(([department, stats]) => (
              <div
                key={department}
                className={cn(
                  "bg-muted/30 rounded-lg p-2 cursor-pointer transition-colors hover:bg-muted text-xs",
                  selectedDepartment === department && "ring-1 ring-primary ring-inset bg-muted"
                )}
                onClick={() => {
                  setSelectedDepartment(prev => prev === department ? null : department);
                }}
              >
                <div className="font-medium capitalize mb-1">
                  {department}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-600 font-medium">
                    On jobs: {stats.assignedAndAvailable}
                  </span>
                  <span className="text-muted-foreground">
                    Warehouse: {stats.availableAndNotInWarehouse}
                  </span>
                </div>
              </div>
            ))}

            {/* Personnel Totals - Compact */}
            <div className="bg-muted/30 rounded-lg p-2 text-xs">
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Warehouse className="h-3 w-3" /> Warehouse:
                  </span>
                  <span>{personnelTotals.techsInWarehouse}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> Jobs:
                  </span>
                  <span>{personnelTotals.techsOnJobs}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <Sun className="h-3 w-3" /> Vacation:
                  </span>
                  <span>{personnelTotals.techsOnVacation}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <CalendarOff className="h-3 w-3" /> Off:
                  </span>
                  <span>{personnelTotals.techsOnDaysOff}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-2 sm:px-4 py-4">
        <div className="space-y-4">
          {visibleTechs.length > 0 ? (
            <div className="space-y-2">
              {visibleTechs.map((tech) => {
                const dayAssignments = getAssignmentsForDate(currentDate);
                const techAssignment = dayAssignments.find(
                  assignment => assignment.technician_id === tech.id
                );
                const availabilityStatus = getAvailabilityStatus(tech.id, currentDate);
                const techName = `${tech.first_name || ''} ${tech.last_name || ''}`.trim() || "Unknown Tech";
                const statusText = techAssignment ? "On job" : availabilityStatus ? `Unavailable (${availabilityStatus})` : "In warehouse";

                return (
                  <div
                    key={tech.id}
                    className="border rounded-md p-3 flex items-start justify-between gap-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{techName}</div>
                      {tech.department && (
                        <div className="text-sm text-muted-foreground capitalize truncate">
                          {tech.department}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium text-right">
                      <span className={cn(
                        techAssignment ? "text-green-600" : 
                        availabilityStatus ? "text-red-600" : "text-muted-foreground"
                      )}>
                        {statusText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-8 w-8 mb-2" />
              <p className="text-muted-foreground">No technicians scheduled</p>
              <p className="text-sm text-muted-foreground">for {format(currentDate, "MMMM d, yyyy")}</p>
            </div>
          )}
        </div>
      </CardContent>

      <PrintDialog
        showDialog={showPrintDialog}
        setShowDialog={setShowPrintDialog}
        printSettings={printSettings}
        setPrintSettings={setPrintSettings}
        generatePDF={generatePDF}
        generateXLS={generateXLS}
        currentMonth={currentDate}
        selectedJobTypes={[]}
      />
    </Card>
    </div>
  );
};