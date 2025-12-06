import React, { useMemo, useState, useEffect } from "react";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, MessageSquare,
  Mail, MoreVertical, Edit, Trash2, Filter, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { formatInJobTimezone } from "@/utils/timezoneUtils";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";

interface DashboardMobileHubProps {
  jobs: any[];
  userRole: string | null;
  onEditClick: (job: any) => void;
  onDeleteClick: (jobId: string) => void;
  onJobClick: (jobId: string) => void;
  onMessagesClick?: () => void;
  onEmailClick?: () => void;
}

const themeTokens = {
  bg: "bg-background",
  card: "bg-card border-border shadow-sm",
  textMain: "text-foreground",
  textMuted: "text-muted-foreground",
  divider: "border-border",
  toolBg: "bg-card border-border shadow-sm",
  accent: "bg-primary text-primary-foreground",
  hover: "hover:bg-accent",
};

export const DashboardMobileHub: React.FC<DashboardMobileHubProps> = ({
  jobs,
  userRole,
  onEditClick,
  onDeleteClick,
  onJobClick,
  onMessagesClick,
  onEmailClick,
}) => {
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedJobStatuses, setSelectedJobStatuses] = useState<string[]>([]);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);

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

  // Get distinct job types and statuses for filter options
  const distinctJobTypes = useMemo(() => {
    if (!jobs) return [];
    const types = jobs
      .filter(job => job.job_type !== 'tour')
      .map(job => job.job_type)
      .filter(Boolean);
    return Array.from(new Set(types));
  }, [jobs]);

  const distinctJobStatuses = useMemo(() => {
    if (!jobs) return [];
    const statuses = jobs
      .filter(job => job.job_type !== 'tour')
      .map(job => job.status)
      .filter(Boolean);
    return Array.from(new Set(statuses));
  }, [jobs]);

  const selectedDateJobs = useMemo(() => {
    if (!jobs) return [];
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    return jobs
      .filter((job) => {
        if (job.job_type === 'tour') return false;

        const jobStart = new Date(job.start_time);
        const jobEnd = new Date(job.end_time);

        const isInDateRange = isWithinInterval(dayStart, { start: startOfDay(jobStart), end: endOfDay(jobEnd) }) ||
          isWithinInterval(dayEnd, { start: startOfDay(jobStart), end: endOfDay(jobEnd) });

        if (!isInDateRange) return false;

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
  }, [jobs, selectedDate, selectedJobTypes, selectedJobStatuses]);

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  if (!isMobile) return null;

  return (
    <div className={cn("min-h-screen", themeTokens.bg, "font-sans pb-24")}>
      <div className="max-w-md mx-auto space-y-6 p-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-blue-500 text-xs font-semibold uppercase tracking-[0.08em]">
            <span>Dashboard</span>
          </div>
          <h2 className={cn("text-2xl font-bold", themeTokens.textMain)}>Agenda</h2>
        </div>

        {/* Quick Actions */}
        {canEdit && (onMessagesClick || onEmailClick) && (
          <div>
            <h3 className={cn("text-xs font-bold uppercase tracking-wider mb-3", themeTokens.textMuted)}>Quick Actions</h3>
            <div className="flex gap-3">
              {onMessagesClick && (
                <button
                  onClick={onMessagesClick}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border flex-1 h-[80px] transition-all",
                    themeTokens.toolBg,
                    "hover:border-blue-500 hover:scale-105 active:scale-95"
                  )}
                >
                  <MessageSquare size={24} className="mb-2 text-blue-500" />
                  <span className={cn("text-[10px] font-bold text-center leading-tight", themeTokens.textMain)}>
                    Mensajes
                  </span>
                </button>
              )}
              {onEmailClick && (
                <button
                  onClick={onEmailClick}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border flex-1 h-[80px] transition-all",
                    themeTokens.toolBg,
                    "hover:border-blue-500 hover:scale-105 active:scale-95"
                  )}
                >
                  <Mail size={24} className="mb-2 text-emerald-500" />
                  <span className={cn("text-[10px] font-bold text-center leading-tight", themeTokens.textMain)}>
                    Email
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        {(distinctJobTypes.length > 0 || distinctJobStatuses.length > 0) && (
          <div className="flex gap-2">
            {/* Job Type Filter */}
            {distinctJobTypes.length > 0 && (
              <Popover open={isTypeFilterOpen} onOpenChange={setIsTypeFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("flex-1", themeTokens.card)}>
                    <Filter className="h-4 w-4 mr-2" />
                    <span className={themeTokens.textMain}>Type</span>
                    {selectedJobTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
                        {selectedJobTypes.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-56 p-2", themeTokens.card)} align="start">
                  <div className="space-y-1">
                    {distinctJobTypes.map((type) => (
                      <button
                        key={type}
                        onClick={() => handleJobTypeSelection(type)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                          themeTokens.hover,
                          themeTokens.textMain
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
                  <Button variant="outline" size="sm" className={cn("flex-1", themeTokens.card)}>
                    <Filter className="h-4 w-4 mr-2" />
                    <span className={themeTokens.textMain}>Status</span>
                    {selectedJobStatuses.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1">
                        {selectedJobStatuses.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-56 p-2", themeTokens.card)} align="start">
                  <div className="space-y-1">
                    {distinctJobStatuses.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleJobStatusSelection(status)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                          themeTokens.hover,
                          themeTokens.textMain
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
              className={cn("p-1 rounded", themeTokens.hover, themeTokens.textMain)}
            >
              <ChevronLeft size={20} />
            </button>
            <div className="text-center cursor-pointer" onClick={handleToday}>
              <div className={cn("text-lg font-bold", themeTokens.textMain)}>
                {isToday(selectedDate) ? "Today" : format(selectedDate, "MMM d")}
              </div>
              <div className={cn("text-xs", themeTokens.textMuted)}>
                {format(selectedDate, "EEE")}
              </div>
            </div>
            <button
              onClick={handleNextDay}
              className={cn("p-1 rounded", themeTokens.hover, themeTokens.textMain)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={cn("rounded-lg px-3", themeTokens.card, themeTokens.textMain)}
              onClick={handleToday}
            >
              Today
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className={cn("rounded-lg", themeTokens.card)}>
                  <CalendarIcon className={cn("h-4 w-4", themeTokens.textMain)} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className={cn("p-0 w-auto", themeTokens.card)} align="end" sideOffset={8}>
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
          {selectedDateJobs.length === 0 ? (
            <Card className={cn("p-6 rounded-2xl", themeTokens.card)}>
              <div className={cn("text-sm text-center", themeTokens.textMuted)}>
                No hay trabajos programados para esta fecha
              </div>
            </Card>
          ) : (
            selectedDateJobs.map((job) => {
              const jobColor = job.color || "#3b82f6";
              const jobTimezone = job.timezone || 'Europe/Madrid';
              const assignedCount = job.job_assignments?.length || 0;

              // Calculate total needed crew
              let totalNeeded = 0;
              if (job.sound_job_personnel?.[0]) {
                const sp = job.sound_job_personnel[0];
                totalNeeded += (sp.foh_engineers || 0) + (sp.mon_engineers || 0) + (sp.pa_techs || 0) + (sp.rf_techs || 0);
              }
              if (job.lights_job_personnel?.[0]) {
                const lp = job.lights_job_personnel[0];
                totalNeeded += (lp.lighting_designers || 0) + (lp.lighting_techs || 0) + (lp.spot_ops || 0) + (lp.riggers || 0);
              }
              if (job.video_job_personnel?.[0]) {
                const vp = job.video_job_personnel[0];
                totalNeeded += (vp.video_directors || 0) + (vp.camera_ops || 0) + (vp.playback_techs || 0) + (vp.video_techs || 0);
              }

              const departments = job.job_departments?.map((d: any) => d.department) || [];

              return (
                <Card
                  key={job.id}
                  className={cn(
                    "p-4 rounded-xl border-l-4 transition-all",
                    themeTokens.card
                  )}
                  style={{ borderLeftColor: jobColor }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className={cn("font-bold text-lg", themeTokens.textMain)}>{job.title}</h3>
                      <div className={cn("text-xs mt-1", themeTokens.textMuted)}>
                        {job.location_data?.name || "Sin ubicación"}
                      </div>
                      {departments.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {departments.map((dept: string) => (
                            <span
                              key={dept}
                              className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-muted", themeTokens.textMuted)}
                            >
                              {dept}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status && (
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          job.status.toLowerCase() === 'confirmado' ? "bg-cyan-500/10 text-cyan-500" :
                          job.status.toLowerCase() === 'tentativa' ? "bg-blue-500/10 text-blue-500" :
                          job.status.toLowerCase() === 'completado' ? "bg-purple-500/10 text-purple-500" :
                          job.status.toLowerCase() === 'cancelado' ? "bg-red-500/10 text-red-500" :
                          "bg-slate-500/10 text-slate-500"
                        )}>
                          {job.status}
                        </span>
                      )}
                      {canEdit && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical size={16} className={themeTokens.textMuted} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className={cn("min-w-[140px]", themeTokens.card, themeTokens.textMain)}>
                            <DropdownMenuItem onClick={() => onEditClick(job)}>
                              <Edit size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onDeleteClick(job.id)}
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

                  <div className={cn("flex items-center gap-4 text-xs mt-3 pb-3 border-b border-dashed", themeTokens.textMuted, themeTokens.divider)}>
                    <div>
                      {formatInJobTimezone(job.start_time, "HH:mm", jobTimezone)} - {formatInJobTimezone(job.end_time, "HH:mm", jobTimezone)}
                    </div>
                    <div>
                      {assignedCount}/{totalNeeded || assignedCount} Crew
                    </div>
                  </div>

                  <div className="mt-3">
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => onJobClick(job.id)}
                    >
                      Ver Detalles
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
