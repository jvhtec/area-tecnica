import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DateTypeContextMenu } from "./DateTypeContextMenu";
import { supabase } from "@/lib/supabase";
import {
  format,
  addDays,
  subDays,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Users,
  Music2,
  Lightbulb,
  Video,
  Plane,
  Wrench,
  Star,
  Moon,
  Mic,
  Calendar,
} from "lucide-react";
import { formatInJobTimezone, isJobOnDate } from "@/utils/timezoneUtils";

interface MobileDayCalendarProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department?: string;
  onDateTypeChange: () => void;
  selectedJobTypes: string[];
}

const departmentIcons = {
  lights: Lightbulb,
  video: Video,
  tour: Music2,
  travel: Plane,
  logistics: Wrench,
  backline: Mic,
};

const jobTypeColors = {
  tourdate: "hsl(var(--chart-1))",
  tour: "hsl(var(--chart-2))",
  single: "hsl(var(--chart-3))",
  dryhire: "hsl(var(--chart-4))",
  festival: "hsl(var(--chart-5))",
};

export const MobileDayCalendar: React.FC<MobileDayCalendarProps> = ({
  date = new Date(),
  onDateSelect,
  jobs = [],
  department,
  onDateTypeChange,
  selectedJobTypes,
}) => {
  const [currentDate, setCurrentDate] = useState(date);
  const [dateTypes, setDateTypes] = useState<Record<string, any>>({});
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Update current date when prop changes
  useEffect(() => {
    if (date) {
      setCurrentDate(date);
    }
  }, [date]);

  // Get jobs for the current date
  const getJobsForDate = useCallback((targetDate: Date) => {
    if (!jobs) return [];
    return jobs.filter((job) => {
      try {
        if (!job.start_time || !job.end_time) {
          console.warn("Invalid date found for job:", job);
          return false;
        }

        const jobTimezone = job.timezone || 'Europe/Madrid';
        const isWithinDuration = isJobOnDate(job.start_time, job.end_time, targetDate, jobTimezone);

        const matchesDepartment = department
          ? isWithinDuration && job.job_departments.some((d: any) => d.department === department)
          : isWithinDuration;
        const matchesJobType = selectedJobTypes.length === 0 || selectedJobTypes.includes(job.job_type);
        return matchesDepartment && matchesJobType;
      } catch (error) {
        console.error("Error processing job dates:", error, job);
        return false;
      }
    });
  }, [jobs, department, selectedJobTypes]);

  // Fetch date types for current date jobs
  useEffect(() => {
    const fetchDateTypes = async () => {
      const dayJobs = getJobsForDate(currentDate);
      const jobIds = dayJobs.map(job => job.id);
      const formattedDate = format(currentDate, 'yyyy-MM-dd');

      if (jobIds.length === 0) {
        setDateTypes({});
        return;
      }

      const { data, error } = await supabase
        .from("job_date_types")
        .select("*")
        .in("job_id", jobIds)
        .eq("date", formattedDate);

      if (error) {
        console.error("Error fetching date types:", error);
        return;
      }

      const typesMap = data.reduce((acc: Record<string, any>, curr) => ({
        ...acc,
        [`${curr.job_id}-${curr.date}`]: curr,
      }), {});
      setDateTypes(typesMap);
    };

    fetchDateTypes();
  }, [currentDate, getJobsForDate]);

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
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      // Swipe left - next day
      navigateToNext();
    } else if (distance < -minSwipeDistance) {
      // Swipe right - previous day
      navigateToPrevious();
    }
  };

  const navigateToPrevious = () => {
    const previousDay = subDays(currentDate, 1);
    setCurrentDate(previousDay);
    onDateSelect(previousDay);
  };

  const navigateToNext = () => {
    const nextDay = addDays(currentDate, 1);
    setCurrentDate(nextDay);
    onDateSelect(nextDay);
  };

  const navigateToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onDateSelect(today);
  };

  const dayJobs = getJobsForDate(currentDate);

  const renderJobCard = (job: any) => {
    const jobColor = jobTypeColors[job.job_type as keyof typeof jobTypeColors] || "hsl(var(--muted))";
    const formattedDate = format(currentDate, 'yyyy-MM-dd');
    const dateTypeKey = `${job.id}-${formattedDate}`;
    const dateType = dateTypes[dateTypeKey];

    return (
      <DateTypeContextMenu
        key={job.id}
        jobId={job.id}
        date={currentDate}
        onTypeChange={onDateTypeChange}
      >
        <Card className="mb-3 hover:shadow-md transition-shadow cursor-pointer border-l-4" 
              style={{ borderLeftColor: jobColor }}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm leading-tight">{job.job_name}</h3>
                {job.venue && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    <span>{job.venue}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge 
                  variant="secondary" 
                  className="text-xs px-2 py-0"
                  style={{ backgroundColor: jobColor, color: 'white' }}
                >
                  {job.job_type}
                </Badge>
                {dateType && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {dateType.date_type === 'travel' && '✈️'}
                          {dateType.date_type === 'setup' && '🔧'}
                          {dateType.date_type === 'show' && '🎵'}
                          {dateType.date_type === 'off' && '😴'}
                          {dateType.date_type === 'rehearsal' && '🎭'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="capitalize">{dateType.date_type}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  {formatInJobTimezone(job.start_time, job.timezone)} - {formatInJobTimezone(job.end_time, job.timezone)}
                </span>
              </div>
              {job.job_departments && job.job_departments.length > 0 && (
                <div className="flex gap-1">
                  {job.job_departments.slice(0, 3).map((dept: any) => {
                    const IconComponent = departmentIcons[dept.department as keyof typeof departmentIcons] || Users;
                    return (
                      <IconComponent key={dept.department} className="h-3 w-3" />
                    );
                  })}
                  {job.job_departments.length > 3 && (
                    <span className="text-xs">+{job.job_departments.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </DateTypeContextMenu>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-grow p-4">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={navigateToPrevious} className="p-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="text-center">
            <div className="text-lg font-semibold">
              {format(currentDate, 'EEEE')}
            </div>
            <div className={cn(
              "text-sm",
              isToday(currentDate) ? "text-primary font-medium" : "text-muted-foreground"
            )}>
              {format(currentDate, 'MMM d, yyyy')}
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={navigateToNext} className="p-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Today button */}
        {!isToday(currentDate) && (
          <div className="flex justify-center mb-4">
            <Button variant="outline" size="sm" onClick={navigateToToday}>
              <Calendar className="h-4 w-4 mr-1" />
              Today
            </Button>
          </div>
        )}

        {/* Swipe area for jobs */}
        <div
          className="flex-grow overflow-y-auto"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {dayJobs.length > 0 ? (
            <div className="space-y-2">
              {dayJobs.map(renderJobCard)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Calendar className="h-8 w-8 mb-2" />
              <p className="text-sm">No jobs scheduled</p>
              <p className="text-xs">Swipe left/right to navigate</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};