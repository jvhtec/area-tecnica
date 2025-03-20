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
import { JobOptionsContextMenu } from "./JobOptionsContextMenu";
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
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useQueryClient } from "@tanstack/react-query";
import { createAllFoldersForJob } from "@/utils/flex-folders";

interface CalendarSectionProps {
  date: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  jobs?: any[];
  department?: string;
  onDateTypeChange: () => void;
  userRole?: string | null;
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
  userRole,
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
  const [editingJob, setEditingJob] = useState<any | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        const startDate = job.start_time ? parseISO(job.start_time) : null;
        const endDate = job.end_time ? parseISO(job.end_time) : null;
        if (!startDate || !endDate) {
          console.warn("Invalid date found for job:", job);
          return false;
        }
        const compareDate = format(date, "yyyy-MM-dd");
        const jobStartDate = format(startDate, "yyyy-MM-dd");
        const jobEndDate = format(endDate, "yyyy-MM-dd");
        const isSingleDayJob = jobStartDate === jobEndDate;
        const isWithinDuration = isSingleDayJob
          ? compareDate === jobStartDate
          : compareDate >= jobStartDate && compareDate <= jobEndDate;
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
    const doc = new jsPDF("landscape");
    const currentDate = date || new Date();
    let startDate: Date, endDate: Date;

    const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png";
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    }).catch(() => null);

    const logoWidth = 50;
    const logoHeight = logo ? logoWidth * (logo.height / logo.width) : 0;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    const logoTopY = 10;
    const monthTitleY = logo ? logoTopY + logoHeight + 5 : 20;
    const calendarStartY = monthTitleY + 10;
    const footerSpace = 40;

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
    const cellWidth = 40;
    const cellHeight = 30;
    const startX = 10;
    const daysOfWeek = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
    const dateTypeLabels: Record<string, string> = {
      travel: "V",
      setup: "M",
      show: "S",
      off: "O",
      rehearsal: "E",
    };

    for (const [pageIndex, monthStart] of months.entries()) {
      if (pageIndex > 0) doc.addPage("landscape");

      const logoX = logo ? (pageWidth - logoWidth) / 2 : 0;
      if (logo) {
        doc.addImage(logo, "PNG", logoX, logoTopY, logoWidth, logoHeight);
      }

      doc.setFontSize(16);
      doc.setTextColor(51, 51, 51);
      doc.text(format(monthStart, "MMMM yyyy"), pageWidth / 2, monthTitleY, { align: "center" });

      daysOfWeek.forEach((day, index) => {
        doc.setFillColor(41, 128, 185);
        doc.rect(startX + index * cellWidth, calendarStartY, cellWidth, 10, "F");
        doc.setTextColor(255);
        doc.setFontSize(10);
        doc.text(day, startX + index * cellWidth + 15, calendarStartY + 7);
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
      
      let currentY = calendarStartY + 10;
      
      for (const week of weeks) {
        for (const [dayIndex, day] of week.entries()) {
          const x = startX + dayIndex * cellWidth;
          doc.setDrawColor(200);
          doc.rect(x, currentY, cellWidth, cellHeight);
          if (!day) continue;
          doc.setTextColor(isSameMonth(day, monthStart) ? 0 : 200);
          doc.setFontSize(12);
          doc.text(format(day, "d"), x + 2, currentY + 5);
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
          let eventY = currentY + 8;
          for (const [index, job] of dayJobs.slice(0, 8).entries()) {
            const key = `${job.id}-${format(day, "yyyy-MM-dd")}`;
            const dateType = dateTypes[key]?.type;
            const typeLabel = dateType ? dateTypeLabels[dateType] : "";
            const baseColor = job.color || "#cccccc";
            const [r, g, b] = hexToRgb(baseColor);
            const textColor = getContrastColor(baseColor);
            doc.setFillColor(r, g, b);
            doc.rect(x + 1, eventY + index * 5, cellWidth - 2, 4, "F");
            if (typeLabel) {
              doc.setFontSize(8);
              doc.setTextColor(textColor);
              doc.text(typeLabel, x + 3, eventY + index * 5 + 3);
            }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(textColor);
            const titleX = typeLabel ? x + 8 : x + 3;
            doc.text(job.title.substring(0, 18), titleX, eventY + index * 5 + 3);
          }
        }
        currentY += cellHeight;
      }
      
      if (pageIndex === 0) {
        const legendY = currentY + 10;
        doc.setFontSize(8);
        doc.setTextColor(0);
        Object.entries(dateTypeLabels).forEach(([type, label], index) => {
          doc.text(`${label} = ${type}`, 10 + index * 40, legendY);
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

  const handleEditJob = (job: any) => {
    setEditingJob(job);
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!window.confirm("Are you sure you want to delete this job?")) {
      return;
    }

    try {
      console.log("Starting job deletion process for job:", jobId);

      const { error: taskDocsError } = await supabase
        .from("task_documents")
        .delete()
        .or(
          `sound_task_id.in.(select id from sound_job_tasks where job_id='${jobId}'),lights_task_id.in.(select id from lights_job_tasks where job_id='${jobId}'),video_task_id.in.(select id from video_job_tasks where job_id='${jobId}')`
        );

      if (taskDocsError) {
        console.error("Error deleting task documents:", taskDocsError);
        throw taskDocsError;
      }

      await Promise.all([
        supabase.from("sound_job_tasks").delete().eq("job_id", jobId),
        supabase.from("lights_job_tasks").delete().eq("job_id", jobId),
        supabase.from("video_job_tasks").delete().eq("job_id", jobId)
      ]);

      await Promise.all([
        supabase.from("sound_job_personnel").delete().eq("job_id", jobId),
        supabase.from("lights_job_personnel").delete().eq("job_id", jobId),
        supabase.from("video_job_personnel").delete().eq("job_id", jobId)
      ]);

      const { error: jobDocsError } = await supabase
        .from("job_documents")
        .delete()
        .eq("job_id", jobId);

      if (jobDocsError) {
        console.error("Error deleting job documents:", jobDocsError);
        throw jobDocsError;
      }

      const { error: assignmentsError } = await supabase
        .from("job_assignments")
        .delete()
        .eq("job_id", jobId);

      if (assignmentsError) {
        console.error("Error deleting job assignments:", assignmentsError);
        throw assignmentsError;
      }

      const { error: departmentsError } = await supabase
        .from("job_departments")
        .delete()
        .eq("job_id", jobId);

      if (departmentsError) {
        console.error("Error deleting job departments:", departmentsError);
        throw departmentsError;
      }

      const { error: jobError } = await supabase
        .from("jobs")
        .delete()
        .eq("id", jobId);

      if (jobError) {
        console.error("Error deleting job:", jobError);
        throw jobError;
      }

      toast({
        title: "Job deleted successfully",
        description: "The job and all related records have been removed."
      });
      
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: any) {
      console.error("Error in deletion process:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const createFlexFolders = async (job: any) => {
    try {
      console.log("Starting folder creation for job:", job.id);

      const { data: existingFolders } = await supabase
        .from("flex_folders")
        .select("id")
        .eq("job_id", job.id)
        .limit(1);

      if (existingFolders && existingFolders.length > 0) {
        console.log("Found existing folders in final check:", existingFolders);
        toast({
          title: "Folders already exist",
          description: "Flex folders have already been created for this job.",
          variant: "destructive"
        });
        return;
      }

      const startDate = new Date(job.start_time);
      const documentNumber = startDate
        .toISOString()
        .slice(2, 10)
        .replace(/-/g, "");

      const formattedStartDate = new Date(job.start_time).toISOString().split(".")[0] + ".000Z";
      const formattedEndDate = new Date(job.end_time).toISOString().split(".")[0] + ".000Z";

      await createAllFoldersForJob(job, formattedStartDate, formattedEndDate, documentNumber);
      
      const { error } = await supabase
        .from("jobs")
        .update({ flex_folders_created: true })
        .eq("id", job.id);
      
      if (error) throw error;

      console.log("Successfully created folders for job:", job.id);
      toast({
        title: "Success",
        description: "Flex folders have been created successfully."
      });
      
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (error: any) {
      console.error("Error creating Flex folders:", error);
      toast({
        title: "Error creating folders",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const JobCard = ({ job, date, dateTypes, setDateTypes, onEditJob, onDeleteJob, onCreateFlexFolders, userRole }) => {
    const hasDateType = dateTypes && dateTypes[`${job.id}-${format(date, "yyyy-MM-dd")}`]?.type;
    const dateType = hasDateType || null;
    
    return (
      <div className="job-card-wrapper relative">
        <JobOptionsContextMenu
          jobId={job.id}
          onEditJob={onEditJob}
          onDeleteJob={onDeleteJob}
          onCreateFlexFolders={onCreateFlexFolders}
          flexFoldersExist={job.flex_folders_created || false}
          userRole={userRole}
        >
          <div className="relative z-10 bg-white dark:bg-gray-800 rounded border p-1 text-xs hover:shadow-md transition-shadow cursor-pointer"
              style={{
                backgroundColor: job.color || "#cccccc",
                color: job.color ? getContrastColor(job.color) : "#000000",
                borderColor: "rgba(0,0,0,0.1)",
              }}
          >
            <div className="flex items-center gap-1">
              {dateType && (
                <Badge variant="outline" className="bg-white/25 text-[0.65rem] px-1 h-4">
                  {dateType}
                </Badge>
              )}
              <span className="truncate">{job.title}</span>
            </div>
          </div>
        </JobOptionsContextMenu>
        
        <div className="absolute inset-0 z-20">
          <DateTypeContextMenu
            jobId={job.id}
            date={date}
            onTypeChange={onDateTypeChange}
          >
            <div className="w-full h-full date-type-context-trigger"></div>
          </DateTypeContextMenu>
        </div>
      </div>
    );
  };

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
        
        {editingJob && (
          <EditJobDialog
            open={!!editingJob}
            onOpenChange={() => setEditingJob(null)}
            job={editingJob}
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
          const maxVisibleJobs = 7;
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
                  <div className="text-xs text-muted-foreground mt-1 bg-accent/30 p-1 rounded">
                    +{dayJobs.length - maxVisibleJobs} more
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
