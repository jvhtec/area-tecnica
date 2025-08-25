import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Users } from "lucide-react";
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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

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

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      navigateToNext();
    }
    if (isRightSwipe) {
      navigateToPrevious();
    }
  };

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

  const visibleTechs = houseTechs.filter(tech => shouldShowTechOnDay(tech, currentDate));

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
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold">House Techs</CardTitle>
        
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
        
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={navigateToToday}
            className={cn(
              isToday(currentDate) && "bg-primary text-primary-foreground"
            )}
          >
            Today
          </Button>
        </div>
      </CardHeader>

      <CardContent 
        className="flex-1 p-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="space-y-4">
          {visibleTechs.length > 0 ? (
            <div className="space-y-2">
              {visibleTechs.map((tech) => {
                const techAssignment = currentDateAssignments.find(
                  assignment => assignment.technician_id === tech.id
                );
                const availabilityStatus = getAvailabilityStatus(tech.id, currentDate);

                const techName = `${tech.first_name ?? ''} ${tech.last_name ?? ''}`.trim() || 'Technician';
                const dept = tech.department ? String(tech.department) : '';

                return (
                  <div
                    key={tech.id}
                    className="border rounded-md p-3 flex items-start justify-between gap-3 hover:bg-accent/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{techName}</div>
                      {dept && (
                        <div className="text-xs text-muted-foreground capitalize truncate">{dept}</div>
                      )}
                    </div>
                    <div className="text-right text-sm min-w-[40%]">
                      {techAssignment ? (
                        <>
                          <div className="font-medium text-primary">On job</div>
                          <div className="truncate">{techAssignment.job?.title || 'Assigned'}</div>
                        </>
                      ) : availabilityStatus ? (
                        <>
                          <div className="font-medium capitalize">{String(availabilityStatus).replace('_', ' ')}</div>
                          <div className="text-muted-foreground">Unavailable</div>
                        </>
                      ) : (
                        <div className="text-muted-foreground">In warehouse</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-8 w-8 mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No technicians scheduled</p>
              <p className="text-sm text-muted-foreground">for {format(currentDate, "MMMM d, yyyy")}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};