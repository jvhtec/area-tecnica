
import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { DateTypeContextMenu } from "./DateTypeContextMenu";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  Check,
  Printer,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatInJobTimezone, isJobOnDate } from "@/utils/timezoneUtils";

interface CalendarSectionProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department?: string;
  onDateTypeChange: () => void;
}

interface PrintSettings {
  range: "month" | "quarter" | "year";
  jobTypes: {
    tourdate: boolean;
    tour: boolean;
    single: boolean;
    dryhire: boolean;
    festival: boolean;
  };
}

export const CalendarSection: React.FC<CalendarSectionProps> = ({
  date = new Date(),
  onDateSelect,
  jobs = [],
  department,
  onDateTypeChange,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dateTypes, setDateTypes] = useState<Record<string, any>>({});
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    range: "month",
    jobTypes: {
      tourdate: true,
      tour: true,
      single: true,
      dryhire: true,
      festival: true,
    },
  });
  const { toast } = useToast();

  const currentMonth = date || new Date();
  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: firstDayOfMonth, end: lastDayOfMonth });
  const startDay = firstDayOfMonth.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1;
  const prefixDays = Array.from({ length: paddingDays }).map((_, i) => {
    const day = new Date(firstDayOfMonth);
    day.setDate(day.getDate() - (paddingDays - i));
    return day;
  });
  const totalDaysNeeded = 42;
  const suffixDays = Array.from({ length: totalDaysNeeded - (prefixDays.length + daysInMonth.length) }).map((_, i) => {
    const day = new Date(lastDayOfMonth);
    day.setDate(day.getDate() + (i + 1));
    return day;
  });
  const allDays = [...prefixDays, ...daysInMonth, ...suffixDays];
  const distinctJobTypes = jobs ? Array.from(new Set(jobs.map((job) => job.job_type).filter(Boolean))) : [];

  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("selected_job_types")
          .eq("id", session.user.id)
          .single();
        if (error) {
          console.error("Error loading user preferences:", error);
          return;
        }
        if (profile?.selected_job_types) {
          setSelectedJobTypes(profile.selected_job_types);
        }
      } catch (error) {
        console.error("Error in loadUserPreferences:", error);
      }
    };
    loadUserPreferences();
  }, []);

  const saveUserPreferences = async (types: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { error } = await supabase
        .from("profiles")
        .update({ selected_job_types: types })
        .eq("id", session.user.id);
      if (error) {
        console.error("Error saving user preferences:", error);
        toast({
          title: "Error saving preferences",
          description: "Your filter preferences couldn't be saved.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error in saveUserPreferences:", error);
    }
  };

  const handleJobTypeSelection = (type: string) => {
    const newTypes = selectedJobTypes.includes(type)
      ? selectedJobTypes.filter((t) => t !== type)
      : [...selectedJobTypes, type];
    setSelectedJobTypes(newTypes);
    saveUserPreferences(newTypes);
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    console.log("Setting up real-time subscription for date types...");
    
    const channel = supabase.channel('date-type-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_date_types'
        },
        async (payload) => {
          console.log("Date type change detected:", payload);
          
          const { data } = await supabase
            .from("job_date_types")
            .select("*")
            .in("job_id", jobs.map((job: any) => job.id));
            
          if (data) {
            const typesMap = data.reduce((acc: Record<string, any>, curr) => ({
              ...acc,
              [`${curr.job_id}-${curr.date}`]: curr,
            }), {});
            setDateTypes(typesMap);
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up date type subscription...");
      supabase.removeChannel(channel);
    };
  }, [jobs]);

  const fetchDateTypes = async () => {
    if (!jobs?.length) return;
    const { data, error } = await supabase
      .from("job_date_types")
      .select("*")
      .in("job_id", jobs.map((job: any) => job.id));
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

  useEffect(() => {
    fetchDateTypes();
  }, [jobs]);

  const getJobsForDate = (date: Date) => {
    if (!jobs) return [];
    return jobs.filter((job) => {
      try {
        if (!job.start_time || !job.end_time) {
          console.warn("Invalid date found for job:", job);
          return false;
        }

        const jobTimezone = job.timezone || 'Europe/Madrid';
        const isWithinDuration = isJobOnDate(job.start_time, job.end_time, date, jobTimezone);
        
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
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  const getContrastColor = (hex: string): string => {
    const [r, g, b] = hexToRgb(hex);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#000000" : "#ffffff";
  };

  const generatePDF = async (range: "month" | "quarter" | "year") => {
    const filteredJobs = jobs.filter((job) => {
      const jobType = job.job_type?.toLowerCase();
      return jobType && printSettings.jobTypes[jobType] === true;
    });
    
    // Change to A3 format for better layout
    const doc = new jsPDF("landscape", "mm", "a3");
    const currentDate = date || new Date();
    let startDate: Date, endDate: Date;

    const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    }).catch(() => null);

    // A3 landscape dimensions: 420mm x 297mm
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Optimized dimensions for A3 format
    const logoWidth = 60; // Increased from 50
    const logoHeight = logo ? logoWidth * (logo.height / logo.width) : 0;
    
    // Improved vertical spacing for A3
    const logoTopY = 15;
    const monthTitleY = logo ? logoTopY + logoHeight + 8 : 25;
    const calendarStartY = monthTitleY + 15;
    const footerSpace = 50;

    switch (range) {
      case "month":
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
        break;
      case "quarter":
        startDate = startOfQuarter(addMonths(currentDate, 1));
        endDate = endOfQuarter(addMonths(startDate, 2));
        break;
      case "year":
        startDate = startOfYear(currentDate);
        endDate = endOfYear(currentDate);
        break;
      default:
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
    }

    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    
    // Optimized cell dimensions for A3 format
    const cellWidth = 57; // Increased from 40 to better utilize A3 width
    const cellHeight = 40; // Increased from 30 for more content space
    const startX = 15; // Slightly more margin
    
    const daysOfWeek = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
    const dateTypeLabels: Record<string, string> = {
      travel: "V",
      setup: "M",
      show: "S",
      off: "O",
      rehearsal: "E",
    };

 for (const [pageIndex, monthStart] of months.entries()) {
  if (pageIndex > 0) doc.addPage({ format: "a3", orientation: "landscape" });
  // ... rest of your code
      // Add logo if available with better positioning for A3
      const logoX = logo ? (pageWidth - logoWidth) / 2 : 0;
      if (logo) {
        doc.addImage(logo, "PNG", logoX, logoTopY, logoWidth, logoHeight);
      }

      // Month title with larger font for A3
      doc.setFontSize(20); // Increased from 16
      doc.setTextColor(51, 51, 51);
      doc.text(format(monthStart, "MMMM yyyy"), pageWidth / 2, monthTitleY, { align: "center" });

      // Days of week header with improved sizing
      daysOfWeek.forEach((day, index) => {
        doc.setFillColor(41, 128, 185);
        doc.rect(startX + index * cellWidth, calendarStartY, cellWidth, 12, "F"); // Increased header height
        doc.setTextColor(255);
        doc.setFontSize(12); // Increased from 10
        const textX = startX + index * cellWidth + cellWidth / 2;
        doc.text(day, textX, calendarStartY + 8, { align: "center" });
      });

      const monthEnd = endOfMonth(monthStart);
      const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const firstDayOfWeek = 1;
      
      function getDayIndex(d: Date) {
        return firstDayOfWeek === 1 ? (d.getDay() + 6) % 7 : d.getDay();
      }
      
      const offset = getDayIndex(monthStart);
      const offsetDays = Array.from({ length: offset }, () => null);
      const allMonthDays = [...offsetDays, ...monthDays];
      const weeks: Array<Array<Date | null>> = [];
      
      while (allMonthDays.length > 0) {
        weeks.push(allMonthDays.splice(0, 7));
      }
      
      let currentY = calendarStartY + 12; // Adjusted for new header height
      
      for (const week of weeks) {
        for (const [dayIndex, day] of week.entries()) {
          const x = startX + dayIndex * cellWidth;
          doc.setDrawColor(200);
          doc.rect(x, currentY, cellWidth, cellHeight);
          
          if (!day) continue;
          
          // Day number with better positioning and size
          doc.setTextColor(isSameMonth(day, monthStart) ? 0 : 150);
          doc.setFontSize(14); // Increased from 12
          doc.text(format(day, "d"), x + 3, currentY + 7);
          
          const dayJobs = filteredJobs.filter((job) => {
            try {
              const startDate = job.start_time ? parseISO(job.start_time) : null;
              const endDate = job.end_time ? parseISO(job.end_time) : null;
              if (!startDate || !endDate) return false;
              const compareDate = format(day, "yyyy-MM-dd");
              const jobStartDate = format(startDate, "yyyy-MM-dd");
              const jobEndDate = format(endDate, "yyyy-MM-dd");
              const isSingleDayJob = jobStartDate === jobEndDate;
              return isSingleDayJob
                ? compareDate === jobStartDate
                : compareDate >= jobStartDate && compareDate <= jobEndDate;
            } catch (error) {
              console.error("Error processing job dates for PDF:", error, job);
              return false;
            }
          });
          
          let eventY = currentY + 12; // Better spacing from day number
          const maxEvents = 10; // Increased from 8 to show more events
          const eventHeight = 3.5; // Slightly increased event height
          
          for (const [index, job] of dayJobs.slice(0, maxEvents).entries()) {
            const key = `${job.id}-${format(day, "yyyy-MM-dd")}`;
            const dateType = dateTypes[key]?.type;
            const typeLabel = dateType ? dateTypeLabels[dateType] : "";
            const baseColor = job.color || "#cccccc";
            const [r, g, b] = hexToRgb(baseColor);
            const textColor = getContrastColor(baseColor);
            
            // Event background with better dimensions
            doc.setFillColor(r, g, b);
            doc.rect(x + 1, eventY + index * (eventHeight + 0.5), cellWidth - 2, eventHeight, "F");
            
            // Date type label
            if (typeLabel) {
              doc.setFontSize(8);
              doc.setTextColor(textColor);
              doc.text(typeLabel, x + 2, eventY + index * (eventHeight + 0.5) + 2.5);
            }
            
            // Job title with better sizing and positioning
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7.5); // Slightly increased
            doc.setTextColor(textColor);
            const titleX = typeLabel ? x + 8 : x + 2;
            const maxTitleLength = 24; // Increased from 18
            doc.text(job.title.substring(0, maxTitleLength), titleX, eventY + index * (eventHeight + 0.5) + 2.5);
          }
          
          // "More events" indicator with better styling
          if (dayJobs.length > maxEvents) {
            const moreY = eventY + maxEvents * (eventHeight + 0.5);
            doc.setFillColor(240, 240, 240);
            doc.rect(x + 1, moreY, cellWidth - 2, eventHeight, "F");
            doc.setFontSize(7);
            doc.setTextColor(100);
            doc.text(`+${dayJobs.length - maxEvents} more`, x + 2, moreY + 2.5);
          }
        }
        currentY += cellHeight;
      }
      
      // Enhanced legend with better positioning for A3
      if (pageIndex === 0) {
        const legendY = currentY + 15;
        doc.setFontSize(10); // Increased legend font size
        doc.setTextColor(0);
        doc.text("Date Types:", startX, legendY);
        
        Object.entries(dateTypeLabels).forEach(([type, label], index) => {
          const legendX = startX + 80 + (index * 60); // Better spacing
          doc.text(`${label} = ${type}`, legendX, legendY);
        });
      }
    }
    
    doc.save(`calendar-${range}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    setShowPrintDialog(false);
  };

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

  const renderJobCard = (job: any, day: Date) => (
    <JobCard
      job={job}
      date={day}
      dateTypes={dateTypes}
      setDateTypes={setDateTypes}
    />
  );

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-grow p-4">
        <CalendarHeader
          currentMonth={currentMonth}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onTodayClick={handleTodayClick}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
        <PrintDialog
          showDialog={showPrintDialog}
          setShowDialog={setShowPrintDialog}
          printSettings={printSettings}
          setPrintSettings={setPrintSettings}
          generatePDF={generatePDF}
          currentMonth={currentMonth}
          selectedJobTypes={selectedJobTypes}
        />
        <CalendarFilters
          distinctJobTypes={distinctJobTypes}
          selectedJobTypes={selectedJobTypes}
          isDropdownOpen={isDropdownOpen}
          setIsDropdownOpen={setIsDropdownOpen}
          onJobTypeSelection={handleJobTypeSelection}
        />
        {!isCollapsed && (
          <CalendarGrid
            allDays={allDays}
            currentMonth={currentMonth}
            getJobsForDate={getJobsForDate}
            renderJobCard={renderJobCard}
            onDateSelect={onDateSelect}
          />
        )}
      </CardContent>
    </Card>
  );
};

interface CalendarHeaderProps {
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onTodayClick: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  onTodayClick,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center space-x-4">
        <h2 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" onClick={onPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onTodayClick}>
          Today
        </Button>
        <Button variant="ghost" size="icon" onClick={onToggleCollapse}>
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

interface PrintDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  printSettings: PrintSettings;
  setPrintSettings: React.Dispatch<React.SetStateAction<PrintSettings>>;
  generatePDF: (range: "month" | "quarter" | "year") => void;
  currentMonth: Date;
  selectedJobTypes: string[];
}

const PrintDialog: React.FC<PrintDialogProps> = ({
  showDialog,
  setShowDialog,
  printSettings,
  setPrintSettings,
  generatePDF,
  currentMonth,
  selectedJobTypes,
}) => {
  useEffect(() => {
    if (showDialog) {
      const newJobTypes = {
        tourdate: selectedJobTypes.includes("tourdate"),
        tour: selectedJobTypes.includes("tour"),
        single: selectedJobTypes.includes("single"),
        dryhire: selectedJobTypes.includes("dryhire"),
        festival: selectedJobTypes.includes("festival"),
      };
      setPrintSettings((prev) => ({ ...prev, jobTypes: newJobTypes }));
    }
  }, [showDialog, selectedJobTypes, setPrintSettings]);

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Printer className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Print Range</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Job Types to Include:</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(printSettings.jobTypes).map(([type, checked]) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={`print-${type}`}
                    checked={checked}
                    onCheckedChange={(checked) => {
                      setPrintSettings((prev) => ({
                        ...prev,
                        jobTypes: {
                          ...prev.jobTypes,
                          [type]: !!checked,
                        },
                      }));
                    }}
                  />
                  <Label htmlFor={`print-${type}`} className="capitalize">
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <Button onClick={() => generatePDF("month")}>
            Current Month ({format(currentMonth, "MMMM yyyy")})
          </Button>
          <Button onClick={() => generatePDF("quarter")}>Next Quarter</Button>
          <Button onClick={() => generatePDF("year")}>
            Whole Year ({format(currentMonth, "yyyy")})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface CalendarFiltersProps {
  distinctJobTypes: string[];
  selectedJobTypes: string[];
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  onJobTypeSelection: (type: string) => void;
}

const CalendarFilters: React.FC<CalendarFiltersProps> = ({
  distinctJobTypes,
  selectedJobTypes,
  isDropdownOpen,
  setIsDropdownOpen,
  onJobTypeSelection,
}) => {
  return (
    <div className="relative mb-4">
      <button
        className="border border-gray-300 rounded-md py-1 px-2 text-sm w-full flex items-center justify-between"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        {selectedJobTypes.length > 0 ? selectedJobTypes.join(", ") : "Select Job Types"}
        <ChevronDown className="h-4 w-4 ml-2" />
      </button>
      {isDropdownOpen && (
        <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-md">
          {distinctJobTypes.map((type) => (
            <div
              key={type}
              className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => onJobTypeSelection(type)}
            >
              <span className="text-sm text-black dark:text-white">{type}</span>
              {selectedJobTypes.includes(type) && <Check className="h-4 w-4 text-blue-500" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface CalendarGridProps {
  allDays: Date[];
  currentMonth: Date;
  getJobsForDate: (date: Date) => any[];
  renderJobCard: (job: any, date: Date) => JSX.Element;
  onDateSelect: (date: Date) => void;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  allDays,
  currentMonth,
  getJobsForDate,
  renderJobCard,
  onDateSelect,
}) => {
  return (
    <div className="border rounded-lg overflow-x-auto">
      <div className="grid grid-cols-7 gap-px bg-muted" style={{ minWidth: "980px" }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="bg-background p-2 text-center text-sm text-muted-foreground font-medium">
            {day}
          </div>
        ))}
        {allDays.map((day, i) => {
          const dayJobs = getJobsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const maxVisibleJobs = 7; // Increased from 3 to 7
          return (
            <div
              key={i}
              className={cn(
                "bg-background p-2 min-h-[200px] border-t relative cursor-pointer hover:bg-accent/50 transition-colors calendar-cell",
                !isCurrentMonth && "text-muted-foreground/50"
              )}
              onClick={() => onDateSelect(day)}
            >
              <span className="text-sm">{format(day, "d")}</span>
              <div className="space-y-1 mt-1 calendar-job-list">
                {dayJobs.slice(0, maxVisibleJobs).map((job: any) => renderJobCard(job, day))}
                {dayJobs.length > maxVisibleJobs && (
                  <div className="text-xs text-muted-foreground mt-1 bg-accent/30 p-1 rounded text-center">
                    + {dayJobs.length - maxVisibleJobs} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface JobCardProps {
  job: any;
  date: Date;
  dateTypes: Record<string, any>;
  setDateTypes: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const JobCard: React.FC<JobCardProps> = ({
  job,
  date,
  dateTypes,
  setDateTypes,
}) => {
  const getDateTypeIcon = (jobId: string, date: Date) => {
    const key = `${jobId}-${format(date, "yyyy-MM-dd")}`;
    const dateType = dateTypes[key]?.type;
    switch (dateType) {
      case "travel":
        return <Plane className="h-3 w-3 text-blue-500" />;
      case "setup":
        return <Wrench className="h-3 w-3 text-yellow-500" />;
      case "show":
        return <Star className="h-3 w-3 text-green-500" />;
      case "off":
        return <Moon className="h-3 w-3 text-gray-500" />;
      case "rehearsal":
        return <Mic className="h-3 w-3 text-violet-500" />;
      default:
        return null;
    }
  };

  const getDepartmentIcon = (dept: string) => {
    switch (dept) {
      case "sound":
        return <Music2 className="h-3 w-3" />;
      case "lights":
        return <Lightbulb className="h-3 w-3" />;
      case "video":
        return <Video className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTotalRequiredPersonnel = (job: any) => {
    let total = 0;
    if (job.sound_job_personnel?.length > 0) {
      total +=
        (job.sound_job_personnel[0].foh_engineers || 0) +
        (job.sound_job_personnel[0].mon_engineers || 0) +
        (job.sound_job_personnel[0].pa_techs || 0) +
        (job.sound_job_personnel[0].rf_techs || 0);
    }
    if (job.lights_job_personnel?.length > 0) {
      total +=
        (job.lights_job_personnel[0].lighting_designers || 0) +
        (job.lights_job_personnel[0].lighting_techs || 0) +
        (job.lights_job_personnel[0].spot_ops || 0) +
        (job.lights_job_personnel[0].riggers || 0);
    }
    if (job.video_job_personnel?.length > 0) {
      total +=
        (job.video_job_personnel[0].video_directors || 0) +
        (job.video_job_personnel[0].camera_ops || 0) +
        (job.video_job_personnel[0].playback_techs || 0) +
        (job.video_job_personnel[0].video_techs || 0);
    }
    return total;
  };

  const totalRequired = getTotalRequiredPersonnel(job);
  const currentlyAssigned = job.job_assignments?.length || 0;
  const jobTimezone = job.timezone || 'Europe/Madrid';
  const dateTypeIcon = getDateTypeIcon(job.id, date);

  return (
    <DateTypeContextMenu
      key={job.id}
      jobId={job.id}
      date={date}
      onTypeChange={async () => {
        const { data } = await supabase.from("job_date_types").select("*").eq("job_id", job.id);
        setDateTypes((prev) => ({
          ...prev,
          ...data?.reduce((acc: Record<string, any>, curr) => ({
            ...acc,
            [`${curr.job_id}-${curr.date}`]: curr,
          }), {}),
        }));
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="px-1.5 py-0.5 rounded text-xs truncate hover:bg-accent/50 transition-colors flex items-center gap-1 cursor-pointer"
              style={{
                backgroundColor: `${job.color}20`,
                color: job.color,
              }}
            >
              {dateTypeIcon}
              <span>{job.title}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="w-64 p-2">
            <div className="space-y-2">
              <h4 className="font-semibold">{job.title}</h4>
              {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>
                  {formatInJobTimezone(job.start_time, "MMM d, HH:mm", jobTimezone)} -{" "}
                  {formatInJobTimezone(job.end_time, "MMM d, HH:mm", jobTimezone)}
                </span>
              </div>
              {job.location?.name && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span>{job.location.name}</span>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-sm font-medium">Departments:</div>
                <div className="flex flex-wrap gap-1">
                  {job.job_departments.map((dept: any) => (
                    <Badge key={dept.department} variant="secondary" className="flex items-center gap-1">
                      {getDepartmentIcon(dept.department)}
                      <span className="capitalize">{dept.department}</span>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                <span>
                  {currentlyAssigned}/{totalRequired} assigned
                </span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </DateTypeContextMenu>
  );
};
