import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin,
  Truck, Users, Plus, MoreVertical, Edit, Trash2, Filter, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useJobs } from "@/hooks/useJobs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format, addDays, subDays, isWithinInterval, startOfDay, endOfDay, isToday } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";

interface ToolDefinition {
  label: string;
  to?: string;
  onClick?: () => void;
  icon: React.ElementType;
  color?: string;
}

interface DepartmentMobileHubProps {
  department: string;
  title: string;
  icon: React.ElementType;
  tools: ToolDefinition[];
  canCreateJob?: boolean;
  onCreateJob?: () => void;
  userRole?: string | null;
  onEditJob?: (job: any) => void;
  onDeleteJob?: (jobId: string) => void;
  onJobClick?: (jobId: string) => void;
  onViewDetails?: (job: any) => void;
  onManageAssignments?: (job: any) => void;
  staffData?: {
    warehouse: number;
    onJob: number;
    off: number;
  };
  onStaffClick?: () => void;
}

const themeTokens = {
  dark: {
    bg: "bg-[#05070a]",
    card: "bg-[#0f1219] border-[#1f232e]",
    textMain: "text-white",
    textMuted: "text-[#94a3b8]",
    divider: "border-[#1f232e]",
    toolBg: "bg-[#151820] border-[#2a2e3b]",
    accent: "bg-blue-600 text-white",
    hover: "hover:bg-[#151820]",
  },
  light: {
    bg: "bg-[#f8fafc]",
    card: "bg-white border-slate-200 shadow-sm",
    textMain: "text-slate-900",
    textMuted: "text-slate-500",
    divider: "border-slate-100",
    toolBg: "bg-white border-slate-200 shadow-sm",
    accent: "bg-blue-600 text-white",
    hover: "hover:bg-slate-50",
  },
};

export const DepartmentMobileHub: React.FC<DepartmentMobileHubProps> = ({
  department,
  title,
  icon: Icon,
  tools,
  canCreateJob = false,
  onCreateJob,
  userRole,
  onEditJob,
  onDeleteJob,
  onJobClick,
  onViewDetails,
  onManageAssignments,
  staffData,
  onStaffClick,
}) => {
  const isMobile = useIsMobile();
  const { data: jobs } = useJobs();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedJobStatuses, setSelectedJobStatuses] = useState<string[]>([]);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);

  const t = isDark ? themeTokens.dark : themeTokens.light;

  const canEdit = userRole ? ["admin", "management"].includes(userRole) : false;

  // Load user filter preferences from profiles
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("selected_job_types, selected_job_statuses")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Error loading user preferences:", error);
          return;
        }

        if (profile?.selected_job_types) {
          setSelectedJobTypes(profile.selected_job_types);
        }
        if (profile?.selected_job_statuses) {
          setSelectedJobStatuses(profile.selected_job_statuses);
        }
      } catch (error) {
        console.error("Error in loadUserPreferences:", error);
      }
    };
    loadUserPreferences();
  }, []);

  // Save user preferences to profiles
  const saveUserPreferences = async (types: string[], statuses?: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const updateData = statuses !== undefined
        ? { selected_job_types: types, selected_job_statuses: statuses }
        : { selected_job_types: types };

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", session.user.id);

      if (error) {
        console.error("Error saving user preferences:", error);
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
    saveUserPreferences(newTypes, selectedJobStatuses);
  };

  const handleJobStatusSelection = (status: string) => {
    const newStatuses = selectedJobStatuses.includes(status)
      ? selectedJobStatuses.filter((s) => s !== status)
      : [...selectedJobStatuses, status];
    setSelectedJobStatuses(newStatuses);
    saveUserPreferences(selectedJobTypes, newStatuses);
  };

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    return jobs
      .filter((job) => {
        // Filter out tour jobs (but keep tourdate jobs)
        if (job.job_type === 'tour') return false;

        const isInDepartment = job.job_departments?.some((d: any) => d.department === department);
        if (job.tour_date_id) {
          if (!(isInDepartment && job.tour_date)) return false;
        } else if (!isInDepartment) {
          return false;
        }

        // Apply job type filters
        if (selectedJobTypes.length > 0 && !selectedJobTypes.includes(job.job_type)) {
          return false;
        }

        // Apply job status filters
        if (selectedJobStatuses.length > 0 && !selectedJobStatuses.includes(job.status)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [jobs, department, selectedJobTypes, selectedJobStatuses]);

  // Get distinct job types and statuses for filter options
  const distinctJobTypes = useMemo(() => {
    if (!jobs) return [];
    const typesInDept = jobs
      .filter(job => job.job_type !== 'tour' && job.job_departments?.some((d: any) => d.department === department))
      .map(job => job.job_type)
      .filter(Boolean);
    return Array.from(new Set(typesInDept));
  }, [jobs, department]);

  const distinctJobStatuses = useMemo(() => {
    if (!jobs) return [];
    const statusesInDept = jobs
      .filter(job => job.job_type !== 'tour' && job.job_departments?.some((d: any) => d.department === department))
      .map(job => job.status)
      .filter(Boolean);
    return Array.from(new Set(statusesInDept));
  }, [jobs, department]);

  const selectedDateJobs = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    return filteredJobs.filter((job) => {
      const jobStart = new Date(job.start_time);
      const jobEnd = new Date(job.end_time);

      return isWithinInterval(dayStart, { start: startOfDay(jobStart), end: endOfDay(jobEnd) }) ||
        isWithinInterval(dayEnd, { start: startOfDay(jobStart), end: endOfDay(jobEnd) });
    });
  }, [filteredJobs, selectedDate]);

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  if (!isMobile) return null;

  return (
    <div className={cn("min-h-screen", t.bg, "font-sans p-1 transition-colors duration-300")}>
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold uppercase tracking-[0.08em]">
            <Icon className="h-5 w-5" />
            <span>Department</span>
          </div>
          <h2 className={cn("text-2xl font-bold", t.textMain)}>{title}</h2>
        </div>

        {/* Quick Tools */}
        <div>
          <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3", t.textMuted)}>Quick Tools</h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {tools.map((tool, idx) => (
              <button
                key={idx}
                onClick={tool.onClick || (tool.to ? () => navigate(tool.to!) : undefined)}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border min-w-[80px] h-[80px] flex-shrink-0 transition-all",
                  t.toolBg,
                  "hover:border-blue-500 hover:scale-105 active:scale-95"
                )}
              >
                <tool.icon size={24} className={cn("mb-2", tool.color || "text-blue-500")} />
                <span className={cn("text-[10px] font-bold text-center leading-tight", t.textMain)}>
                  {tool.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Staff Pulse */}
        {staffData && (
          <Card
            className={cn("p-4 rounded-xl border flex items-center justify-between cursor-pointer", t.card, t.hover)}
            onClick={onStaffClick}
          >
            <div>
              <div className={cn("text-xs font-bold uppercase tracking-wider mb-1", t.textMuted)}>
                Staff Availability
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className={cn("text-sm font-bold", t.textMain)}>{staffData.warehouse} Warehouse</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className={cn("text-sm font-bold", t.textMain)}>{staffData.onJob} On Job</span>
                </div>
              </div>
            </div>
            <ChevronRight size={20} className={t.textMuted} />
          </Card>
        )}

        {/* Filters */}
        {(distinctJobTypes.length > 0 || distinctJobStatuses.length > 0) && (
          <div className="flex gap-2">
            {/* Job Type Filter */}
            {distinctJobTypes.length > 0 && (
              <Popover open={isTypeFilterOpen} onOpenChange={setIsTypeFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1", t.card)}>
                    <Filter className="h-4 w-4 mr-2" />
                    <span className={t.textMain}>Type</span>
                    {selectedJobTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
                        {selectedJobTypes.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-56 p-2", t.card)} align="start">
                  <div className="space-y-1">
                    {distinctJobTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => handleJobTypeSelection(type)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                          t.hover,
                          t.textMain
                        )}
                      >
                        <div className={cn("w-4 h-4 border rounded flex items-center justify-center",
                          selectedJobTypes.includes(type) ? "bg-blue-500 border-blue-500" : "border-muted"
                        )}>
                          {selectedJobTypes.includes(type) && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="capitalize">{type}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Job Status Filter */}
            {distinctJobStatuses.length > 0 && (
              <Popover open={isStatusFilterOpen} onOpenChange={setIsStatusFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1", t.card)}>
                    <Filter className="h-4 w-4 mr-2" />
                    <span className={t.textMain}>Status</span>
                    {selectedJobStatuses.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
                        {selectedJobStatuses.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-56 p-2", t.card)} align="start">
                  <div className="space-y-1">
                    {distinctJobStatuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleJobStatusSelection(status)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                          t.hover,
                          t.textMain
                        )}
                      >
                        <div className={cn("w-4 h-4 border rounded flex items-center justify-center",
                          selectedJobStatuses.includes(status) ? "bg-blue-500 border-blue-500" : "border-muted"
                        )}>
                          {selectedJobStatuses.includes(status) && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span>{status}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {/* Date Navigation */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevDay}
              className={cn("p-1 rounded hover:bg-white/10", t.textMain)}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center cursor-pointer" onClick={handleToday}>
              <div className={cn("text-lg font-bold", t.textMain)}>
                {isToday(selectedDate) ? "Today" : format(selectedDate, "MMM d")}
              </div>
              <div className={cn("text-xs", t.textMuted)}>
                {format(selectedDate, "EEE")}
              </div>
            </div>
            <button
              onClick={handleNextDay}
              className={cn("p-1 rounded hover:bg-white/10", t.textMain)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={cn("rounded-lg px-3", t.card, t.textMain)}
              onClick={handleToday}
            >
              Today
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className={cn("rounded-lg", t.card)}>
                  <CalendarIcon className={cn("h-4 w-4", t.textMain)} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className={cn("p-0 w-auto", t.card)} align="end" sideOffset={8}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Job List */}
        <div className="space-y-3">
          {canCreateJob && onCreateJob && (
            <Button
              onClick={onCreateJob}
              className={cn("w-full rounded-xl text-base font-semibold", t.accent)}
            >
              <Plus className="h-5 w-5 mr-2" />
              Create New Job
            </Button>
          )}

          {selectedDateJobs.length === 0 ? (
            <Card className={cn("p-4 rounded-2xl", t.card)}>
              <div className={cn("text-sm text-center", t.textMuted)}>
                No jobs scheduled for this date.
              </div>
            </Card>
          ) : (
            selectedDateJobs.map((job) => {
              const techniciansCount = job.job_assignments?.length ?? job.assignments_count ?? job.crew_size ?? 0;
              const trucksCount = job.logistics_events?.length ?? job.trucks_count ?? 0;
              const isProduction = job.status === "production";
              const jobColor = job.color || (isProduction ? "#10b981" : "#3b82f6");

              return (
                <Card
                  key={job.id}
                  className={cn(
                    "p-3 rounded-xl border-l-4 transition-all",
                    t.card
                  )}
                  style={{ borderLeftColor: jobColor }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className={cn("font-bold text-lg", t.textMain)}>{job.title}</h3>
                      <div className={cn("text-xs flex items-center gap-1 mt-0.5", t.textMuted)}>
                        <MapPin size={12} />
                        {job.location?.name || "Sin ubicación"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const statusLower = (job.status || "").toLowerCase();
                        const statusColorMap: Record<string, string> = {
                          tentativa: "bg-blue-500/10 text-blue-500",
                          confirmado: "bg-cyan-500/10 text-cyan-500",
                          completado: "bg-purple-500/10 text-purple-500",
                          cancelado: "bg-red-500/10 text-red-500",
                        };
                        const colorClass = statusColorMap[statusLower] || "bg-slate-500/10 text-slate-500";

                        return (
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", colorClass)}>
                            {job.status || "Sin estado"}
                          </span>
                        );
                      })()}
                      {canEdit && onEditJob && onDeleteJob && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical size={16} className={t.textMuted} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className={cn("min-w-[140px]", t.card, t.textMain)}>
                            <DropdownMenuItem onClick={() => onEditJob(job)}>
                              <Edit size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDeleteJob(job.id)}
                              className="text-red-600"
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <div className={cn("flex items-center gap-4 text-xs mt-3 pb-3 border-b border-dashed", t.textMuted, t.divider)}>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {format(new Date(job.start_time), "HH:mm")} - {format(new Date(job.end_time), "HH:mm")}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={14} />
                      {techniciansCount} Techs
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Truck size={14} />
                      {trucksCount} Trucks
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => onViewDetails?.(job)}
                    >
                      View Details
                    </Button>
                    <Button
                      className={cn("flex-1", t.accent)}
                      onClick={() => {
                        if (onManageAssignments) {
                          onManageAssignments(job);
                          return;
                        }
                        onJobClick?.(job.id);
                      }}
                    >
                      Manage
                    </Button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
