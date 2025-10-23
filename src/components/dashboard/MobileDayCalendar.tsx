import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateTypeContextMenu } from "./DateTypeContextMenu";
import { MobileJobCard } from "./MobileJobCard";
import { Department } from "@/types/department";
import { supabase } from "@/lib/supabase";
import { PrintDialog, PrintSettings } from "./PrintDialog";
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
  Filter,
  Printer,
  Target,
} from "lucide-react";
import { formatInJobTimezone, isJobOnDate } from "@/utils/timezoneUtils";
import { useMobileDayCalendarSubscriptions } from "@/hooks/useMobileRealtimeSubscriptions";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface MobileDayCalendarProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department?: string;
  onDateTypeChange: () => void;
  selectedJobTypes: string[];
  onJobTypeSelection?: (type: string) => void;
  selectedJobStatuses?: string[];
  onJobStatusSelection?: (status: string) => void;
  onEditClick?: (job: any) => void;
  onDeleteClick?: (jobId: string) => void;
  onJobClick?: (jobId: string) => void;
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
  onJobTypeSelection,
  selectedJobStatuses = [],
  onJobStatusSelection,
  onEditClick,
  onDeleteClick,
  onJobClick,
}) => {
  const [currentDate, setCurrentDate] = useState(date);
  const queryClient = useQueryClient();
  
  // Set up realtime subscriptions for all mobile calendar data
  useMobileDayCalendarSubscriptions();
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

  const distinctJobTypes = jobs ? Array.from(new Set(jobs.map((job) => job.job_type).filter(Boolean))) : [];
  const distinctJobStatuses = jobs ? Array.from(new Set(jobs.map((job) => job.status).filter(Boolean))) : [];

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
        const matchesJobStatus = selectedJobStatuses.length === 0 || selectedJobStatuses.includes(job.status);
        return matchesDepartment && matchesJobType && matchesJobStatus;
      } catch (error) {
        console.error("Error processing job dates:", error, job);
        return false;
      }
    });
  }, [jobs, department, selectedJobTypes, selectedJobStatuses]);

  // Use realtime query for date types instead of manual fetch
  const { data: dateTypes = {} } = useQuery({
    queryKey: ['job_date_types', format(currentDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      const dayJobs = getJobsForDate(currentDate);
      const jobIds = dayJobs.map(job => job.id);
      const formattedDate = format(currentDate, 'yyyy-MM-dd');

      if (jobIds.length === 0) {
        return {};
      }

      const { data, error } = await supabase
        .from("job_date_types")
        .select("*")
        .in("job_id", jobIds)
        .eq("date", formattedDate);

      if (error) {
        console.error("Error fetching date types:", error);
        return {};
      }

      return data.reduce((acc: Record<string, any>, curr) => ({
        ...acc,
        [`${curr.job_id}-${curr.date}`]: curr,
      }), {});
    },
    enabled: getJobsForDate(currentDate).length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Simple PDF/XLS generation for mobile (single day focus)
  const generatePDF = (range: "month" | "quarter" | "year") => {
    console.log("Mobile PDF generation not implemented for", range);
    setShowPrintDialog(false);
  };

  const generateXLS = (range: "month" | "quarter" | "year") => {
    console.log("Mobile XLS generation not implemented for", range);
    setShowPrintDialog(false);
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

  const dayJobs = getJobsForDate(currentDate).sort((a: any, b: any) => {
    // Sort dryhire jobs to the bottom
    if (a.job_type === 'dryhire' && b.job_type !== 'dryhire') return 1;
    if (a.job_type !== 'dryhire' && b.job_type === 'dryhire') return -1;
    return 0; // Keep original order for non-dryhire jobs
  });

  const renderJobCard = (job: any) => {
    return (
      <DateTypeContextMenu
        key={job.id}
        jobId={job.id}
        date={currentDate}
        onTypeChange={() => {
          // Invalidate and refetch date types query
          queryClient.invalidateQueries({ 
            queryKey: ['job_date_types', format(currentDate, 'yyyy-MM-dd')] 
          });
          // Also call the parent callback
          onDateTypeChange();
        }}
      >
        <MobileJobCard
          job={job}
          department={department as Department || 'sound'}
          currentDate={currentDate}
          dateTypes={dateTypes}
          onDateTypeChange={() => {
            // Invalidate and refetch date types query
            queryClient.invalidateQueries({ 
              queryKey: ['job_date_types', format(currentDate, 'yyyy-MM-dd')] 
            });
            // Also call the parent callback
            onDateTypeChange();
          }}
          onEditClick={onEditClick}
          onDeleteClick={onDeleteClick}
          onJobClick={onJobClick}
        />
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
          
          <div className="text-center flex-1">
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
          
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={navigateToToday}>
              <Target className="h-4 w-4" />
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="end">
                <CalendarComponent
                  mode="single"
                  selected={currentDate}
                  onSelect={(date) => {
                    if (date) {
                      setCurrentDate(date);
                      onDateSelect(date);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <Button variant="ghost" size="sm" onClick={navigateToNext} className="p-2">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex gap-2">
            {distinctJobTypes.length > 0 && onJobTypeSelection ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-1" />
                    Types
                    {selectedJobTypes.length > 0 && selectedJobTypes.length < distinctJobTypes.length && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {selectedJobTypes.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className="w-48 z-50 bg-background border shadow-lg"
                  sideOffset={4}
                >
                  {distinctJobTypes.map((type) => (
                    <DropdownMenuCheckboxItem
                      key={type}
                      checked={selectedJobTypes.length === 0 || selectedJobTypes.includes(type)}
                      onCheckedChange={() => onJobTypeSelection(type)}
                      className="capitalize"
                    >
                      {type}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {distinctJobStatuses.length > 0 && onJobStatusSelection ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-1" />
                    Status
                    {selectedJobStatuses.length > 0 && selectedJobStatuses.length < distinctJobStatuses.length && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {selectedJobStatuses.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className="w-48 z-50 bg-background border shadow-lg"
                  sideOffset={4}
                >
                  {distinctJobStatuses.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={selectedJobStatuses.length === 0 || selectedJobStatuses.includes(status)}
                      onCheckedChange={() => onJobStatusSelection(status)}
                      className="capitalize"
                    >
                      {status}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
          
          <Button variant="outline" size="sm" onClick={() => setShowPrintDialog(true)}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>

        {/* Jobs area */}
        <div className="flex-grow overflow-y-auto">
          {dayJobs.length > 0 ? (
            <div className="space-y-2">
              {dayJobs.map(renderJobCard)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Calendar className="h-8 w-8 mb-2" />
              <p className="text-sm">No jobs scheduled</p>
            </div>
          )}
        </div>

        <PrintDialog
          showDialog={showPrintDialog}
          setShowDialog={setShowPrintDialog}
          printSettings={printSettings}
          setPrintSettings={setPrintSettings}
          generatePDF={generatePDF}
          generateXLS={generateXLS}
          currentMonth={currentDate}
          selectedJobTypes={selectedJobTypes}
        />
      </CardContent>
    </Card>
  );
};