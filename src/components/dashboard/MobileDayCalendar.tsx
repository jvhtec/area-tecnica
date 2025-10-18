import React, { useState, useEffect, useCallback } from "react";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { GlassButton, GlassCard, GlassSurface } from "@/components/ui/glass";

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
    <GlassCard
      className="h-full flex flex-col"
      glassSurfaceClassName="h-full"
      glassContentClassName="flex flex-col"
      mobileOptions={{ featureFlag: "mobile_glass_ui" }}
    >
      <CardContent className="flex-grow p-4">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-4">
          <GlassButton
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={navigateToPrevious}
            mobileOptions={{ featureFlag: "mobile_glass_ui" }}
          >
            <ChevronLeft className="h-4 w-4" />
          </GlassButton>
          
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
            <GlassButton
              variant="outline"
              size="sm"
              onClick={navigateToToday}
              mobileOptions={{ featureFlag: "mobile_glass_ui" }}
            >
              <Target className="h-4 w-4" />
            </GlassButton>

            <Popover>
              <PopoverTrigger asChild>
                <GlassButton
                  variant="outline"
                  size="sm"
                  mobileOptions={{ featureFlag: "mobile_glass_ui" }}
                >
                  <Calendar className="h-4 w-4" />
                </GlassButton>
              </PopoverTrigger>
              <PopoverContent className="w-auto border-0 bg-transparent p-0 shadow-none" align="end">
                <GlassSurface
                  className="pointer-events-auto"
                  contentClassName="p-2"
                  mobileOptions={{ featureFlag: "mobile_glass_ui" }}
                  displacementScale={0.38}
                  blurAmount={18}
                >
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
                </GlassSurface>
              </PopoverContent>
            </Popover>
          </div>

          <GlassButton
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={navigateToNext}
            mobileOptions={{ featureFlag: "mobile_glass_ui" }}
          >
            <ChevronRight className="h-4 w-4" />
          </GlassButton>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex gap-2">
            {distinctJobTypes.length > 0 && onJobTypeSelection ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GlassButton
                    variant="outline"
                    size="sm"
                    className="min-w-[92px]"
                    mobileOptions={{ featureFlag: "mobile_glass_ui" }}
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Types
                    {selectedJobTypes.length > 0 && selectedJobTypes.length < distinctJobTypes.length && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {selectedJobTypes.length}
                      </Badge>
                    )}
                  </GlassButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="z-50 w-52 border-0 bg-transparent p-0 shadow-none"
                  sideOffset={6}
                >
                  <GlassSurface
                    className="overflow-hidden"
                    contentClassName="flex flex-col py-2"
                    mobileOptions={{ featureFlag: "mobile_glass_ui" }}
                    displacementScale={0.32}
                    blurAmount={16}
                  >
                    {distinctJobTypes.map((type) => (
                      <DropdownMenuCheckboxItem
                        key={type}
                        checked={selectedJobTypes.length === 0 || selectedJobTypes.includes(type)}
                        onCheckedChange={() => onJobTypeSelection(type)}
                        className="capitalize px-3"
                      >
                        {type}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </GlassSurface>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {distinctJobStatuses.length > 0 && onJobStatusSelection ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <GlassButton
                    variant="outline"
                    size="sm"
                    className="min-w-[92px]"
                    mobileOptions={{ featureFlag: "mobile_glass_ui" }}
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Status
                    {selectedJobStatuses.length > 0 && selectedJobStatuses.length < distinctJobStatuses.length && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {selectedJobStatuses.length}
                      </Badge>
                    )}
                  </GlassButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="z-50 w-52 border-0 bg-transparent p-0 shadow-none"
                  sideOffset={6}
                >
                  <GlassSurface
                    className="overflow-hidden"
                    contentClassName="flex flex-col py-2"
                    mobileOptions={{ featureFlag: "mobile_glass_ui" }}
                    displacementScale={0.32}
                    blurAmount={16}
                  >
                    {distinctJobStatuses.map((status) => (
                      <DropdownMenuCheckboxItem
                        key={status}
                        checked={selectedJobStatuses.length === 0 || selectedJobStatuses.includes(status)}
                        onCheckedChange={() => onJobStatusSelection(status)}
                        className="capitalize px-3"
                      >
                        {status}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </GlassSurface>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <GlassButton
            variant="outline"
            size="sm"
            onClick={() => setShowPrintDialog(true)}
            mobileOptions={{ featureFlag: "mobile_glass_ui" }}
          >
            <Printer className="h-4 w-4 mr-1" />
            Print
          </GlassButton>
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
    </GlassCard>
  );
};