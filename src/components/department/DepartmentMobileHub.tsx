import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon, ChevronRight,
  Plus, MoreVertical, Edit, Trash2, Filter, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTechnicianTheme } from "@/hooks/useTechnicianTheme";
import { cn } from "@/lib/utils";
import { endOfDay, format, isToday, isWithinInterval, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { MobileScreenHeader } from "@/components/mobile/MobileScreenHeader";
import { MobileWeekStrip } from "@/components/mobile/MobileWeekStrip";
import { MobileTile } from "@/components/mobile/MobileTile";
import { MobileAgendaJobCard } from "@/components/mobile/MobileAgendaJobCard";
import { getJobLocationName } from "@/components/mobile/job-location";
import { getMobileAccent, type MobileAccentKey } from "@/components/mobile/mobile-accents";
import { formatInJobTimezone } from "@/utils/timezoneUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { dataLayerClient } from "@/services/dataLayerClient";
import { Badge } from "@/components/ui/badge";
import { isManagementRole } from "@/utils/permissions";
import { getCalendarJobDisplayTitle } from "@/utils/calendarArtists";
import { Skeleton } from "@/components/ui/skeleton";

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
  jobs: any[];
  date: Date;
  onDateSelect: (date: Date) => void;
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
  isLoading?: boolean;
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
  jobs,
  date,
  onDateSelect,
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
  isLoading = false,
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isDark } = useTechnicianTheme();
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedJobStatuses, setSelectedJobStatuses] = useState<string[]>([]);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const selectedDate = date;

  const t = isDark ? themeTokens.dark : themeTokens.light;

  const canEdit = isManagementRole(userRole);

  // Load user filter preferences from profiles
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { session } } = await dataLayerClient.auth.getSession();
        if (!session?.user?.id) return;

        const { data: profile, error } = await dataLayerClient.from("profiles")
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
      const { data: { session } } = await dataLayerClient.auth.getSession();
      if (!session?.user?.id) return;

      const updateData = statuses !== undefined
        ? { selected_job_types: types, selected_job_statuses: statuses }
        : { selected_job_types: types };

      const { error } = await dataLayerClient.from("profiles")
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
        // Filter out jobs with invalid dates
        if (!job.start_time || !job.end_time) return false;

        // Filter out tour jobs (but keep tourdate jobs)
        if (job.job_type === 'tour') return false;

        const isInDepartment = job.job_departments?.some((d: any) => d.department === department);
        if (!isInDepartment) {
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
      .sort((a, b) => {
        const aTime = new Date(a.start_time).getTime();
        const bTime = new Date(b.start_time).getTime();
        // Handle invalid dates by putting them at the end
        if (isNaN(aTime)) return 1;
        if (isNaN(bTime)) return -1;
        return aTime - bTime;
      });
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
      // Double-check dates are valid (should already be filtered in filteredJobs)
      if (!job.start_time || !job.end_time) return false;

      const jobStart = new Date(job.start_time);
      const jobEnd = new Date(job.end_time);

      // Verify dates are valid after parsing
      if (isNaN(jobStart.getTime()) || isNaN(jobEnd.getTime())) return false;

      return isWithinInterval(dayStart, { start: startOfDay(jobStart), end: endOfDay(jobEnd) }) ||
        isWithinInterval(dayEnd, { start: startOfDay(jobStart), end: endOfDay(jobEnd) });
    });
  }, [filteredJobs, selectedDate]);

  const handleToday = () => onDateSelect(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const accentKey = department as MobileAccentKey;
  const accent = getMobileAccent(accentKey);

  if (!isMobile) return null;

  return (
    <div className={cn("min-h-screen", t.bg, "font-sans p-1 transition-colors duration-300")}>
      <div className="max-w-md mx-auto space-y-5 p-3">
        <MobileScreenHeader
          kicker="Departamento"
          title={title}
          subtitle={format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
          accent={accentKey}
          icon={Icon}
        />

        {/* Quick Tools */}
        <div>
          <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-2", t.textMuted)}>Herramientas rápidas</h3>
          <div className="relative -mr-1">
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto no-scrollbar pb-2 pr-10">
            {tools.map((tool, idx) => (
              <MobileTile
                key={idx}
                icon={tool.icon}
                label={tool.label}
                accent={accentKey}
                iconClassName={tool.color}
                onClick={tool.onClick || (tool.to ? () => navigate(tool.to!) : undefined)}
              />
            ))}
            </div>
            {tools.length > 3 && (
              <div
                className={cn("pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-l", isDark ? "from-[#05070a]" : "from-[#f8fafc]", "to-transparent")}
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {/* Staff Pulse */}
        {staffData && (
          <Card
            className={cn("p-4 rounded-xl border flex items-center justify-between cursor-pointer", t.card, t.hover)}
            onClick={onStaffClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStaffClick?.();
              }
            }}
          >
            <div>
              <div className={cn("text-xs font-bold uppercase tracking-wider mb-1", t.textMuted)}>
                Disponibilidad del personal
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                  <span className={cn("text-sm font-bold", t.textMain)}>{staffData.warehouse} en almacén</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className={cn("text-sm font-bold", t.textMain)}>{staffData.onJob} trabajando</span>
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
                  <Button variant="outline" size="sm" className={cn("h-10 flex-1 rounded-full", t.card)}>
                    <Filter className="h-4 w-4 mr-2" />
                    <span className={t.textMain}>Tipo</span>
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
                  <Button variant="outline" size="sm" className={cn("h-10 flex-1 rounded-full", t.card)}>
                    <Filter className="h-4 w-4 mr-2" />
                    <span className={t.textMain}>Estado</span>
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
        <div className="space-y-2">
          <MobileWeekStrip selectedDate={selectedDate} onSelect={onDateSelect} accent={accentKey} />
          <div className="flex items-center justify-end gap-2">
            {!isToday(selectedDate) && (
              <Button
                variant="outline"
                size="sm"
                className={cn("h-10 rounded-full px-4 font-bold", t.card, t.textMain)}
                onClick={handleToday}
              >
                Hoy
              </Button>
            )}
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className={cn("h-10 w-10 rounded-full", t.card)}>
                  <CalendarIcon className={cn("h-4 w-4", t.textMain)} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className={cn("p-0 w-auto", t.card)} align="end" sideOffset={8}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      onDateSelect(date);
                      setCalendarOpen(false);
                    }
                  }}
                  initialFocus
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Job List */}
        <div className="space-y-3">
          {canCreateJob && onCreateJob && (
            <button
              type="button"
              onClick={onCreateJob}
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-md transition-all active:scale-[0.98]",
                accent.fill,
              )}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              Crear trabajo
            </button>
          )}

          {isLoading ? (
            Array.from({ length: 3 }, (_, index) => (
              <Card key={index} className={cn("space-y-3 rounded-2xl p-4", t.card)}>
                <div className="flex items-center justify-between gap-4">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </Card>
            ))
          ) : selectedDateJobs.length === 0 ? (
            <Card className={cn("p-4 rounded-2xl", t.card)}>
              <div className={cn("text-sm text-center", t.textMuted)}>
                No hay trabajos programados para esta fecha.
              </div>
            </Card>
          ) : (
            selectedDateJobs.map((job) => {
              const techniciansCount = job.job_assignments?.length ?? job.assignments_count ?? job.crew_size ?? 0;
              const trucksCount = job.logistics_events?.length ?? job.trucks_count ?? 0;
              const isProduction = job.status === "production";
              const jobColor = job.color || (isProduction ? "#10b981" : "#3b82f6");
              const hasSchedule = Boolean(job.start_time && job.end_time);

              return (
                <MobileAgendaJobCard
                  key={job.id}
                  title={getCalendarJobDisplayTitle(job, selectedDate)}
                  locationName={getJobLocationName(job)}
                  status={job.status || "Sin estado"}
                  jobColor={jobColor}
                  startLabel={hasSchedule ? formatInJobTimezone(job.start_time, "HH:mm", job.timezone || "Europe/Madrid") : "--:--"}
                  endLabel={hasSchedule ? formatInJobTimezone(job.end_time, "HH:mm", job.timezone || "Europe/Madrid") : "--:--"}
                  assignedCount={techniciansCount}
                  trucksCount={trucksCount}
                  accent={accentKey}
                  secondaryLabel="Ver detalles"
                  onSecondary={() => onViewDetails?.(job)}
                  primaryLabel="Gestionar"
                  onPrimary={() => {
                    if (onManageAssignments) {
                      onManageAssignments(job);
                      return;
                    }
                    onJobClick?.(job.id);
                  }}
                  menu={
                    canEdit && onEditJob && onDeleteJob ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1 -mt-1 coarse-hit-target coarse-hit-target-36">
                            <MoreVertical size={16} className={t.textMuted} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={cn("min-w-[140px]", t.card, t.textMain)}>
                          <DropdownMenuItem onClick={() => onEditJob(job)}>
                            <Edit size={14} className="mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteJob(job.id)}
                            className="text-red-600"
                          >
                            <Trash2 size={14} className="mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : undefined
                  }
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
