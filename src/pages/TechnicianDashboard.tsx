
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addWeeks, addMonths, differenceInCalendarDays } from "date-fns";
import { TimeSpanSelector } from "@/components/technician/TimeSpanSelector";
import { MessageManagementDialog } from "@/components/technician/MessageManagementDialog";
import { AssignmentsList } from "@/components/technician/AssignmentsList";
import { AssignmentsGrid } from "@/components/technician/AssignmentsGrid";
import { MyToursSection } from "@/components/technician/MyToursSection";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
// Standardize on the mobile-style assignment cards for all breakpoints
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useTechnicianDashboardSubscriptions } from "@/hooks/useMobileRealtimeSubscriptions";
import { TechnicianTourRates } from "@/components/dashboard/TechnicianTourRates";
import { useTourRateSubscriptions } from "@/hooks/useTourRateSubscriptions";
import { getCategoryFromAssignment } from "@/utils/roleCategory";

type TechnicianJobDocument = {
  id: string;
  file_name: string;
  file_path: string;
  visible_to_tech: boolean;
  uploaded_at: string | null;
  read_only: boolean | null;
  template_type: string | null;
};

type TechnicianJob = {
  id: string;
  title: string | null;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  location_id: string | null;
  job_type: string | null;
  color: string | null;
  status: string | null;
  location?: { name: string | null } | null;
  job_documents?: TechnicianJobDocument[] | null;
};

export type TimesheetAssignmentRow = {
  job_id: string;
  technician_id: string;
  date: string;
  is_schedule_only?: boolean | null;
  jobs: TechnicianJob | null;
};

export type AssignmentMetadata = {
  job_id: string;
  technician_id: string;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  status?: string | null;
  assigned_at?: string | null;
};

export type TechnicianAssignment = {
  id: string;
  job_id: string;
  technician_id: string;
  jobs: TechnicianJob;
  department: string;
  role: string;
  category: string | null;
  sound_role?: string | null;
  lights_role?: string | null;
  video_role?: string | null;
  status?: string | null;
  assigned_at?: string | null;
  covered_dates: string[];
  date_ranges: Array<{ start: string; end: string }>;
};

const determineDepartment = (meta?: AssignmentMetadata | null) => {
  if (!meta) return "unknown";
  if (meta.sound_role) return "sound";
  if (meta.lights_role) return "lights";
  if (meta.video_role) return "video";
  return "unknown";
};

export const compressTimesheetDateRanges = (dates: string[]) => {
  if (!dates.length) return [] as Array<{ start: string; end: string }>;

  const sorted = Array.from(new Set(dates)).sort();
  const ranges: Array<{ start: string; end: string }> = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const diff = differenceInCalendarDays(new Date(current), new Date(prev));
    if (diff === 1) {
      prev = current;
      continue;
    }

    ranges.push({ start: rangeStart, end: prev });
    rangeStart = current;
    prev = current;
  }

  ranges.push({ start: rangeStart, end: prev });
  return ranges;
};

export const buildTechnicianAssignmentsFromTimesheets = (
  rows: TimesheetAssignmentRow[],
  metadataMap: Map<string, AssignmentMetadata>
): TechnicianAssignment[] => {
  const grouped = new Map<string, {
    meta: AssignmentMetadata;
    job: TechnicianJob;
    dates: Set<string>;
  }>();

  rows.forEach(row => {
    if (!row.jobs || row.is_schedule_only) return;
    const key = `${row.job_id}:${row.technician_id}`;
    const meta = metadataMap.get(key);
    if (!meta || meta.status !== 'confirmed') return;

    if (!grouped.has(key)) {
      grouped.set(key, {
        meta,
        job: row.jobs,
        dates: new Set<string>([row.date]),
      });
    } else {
      grouped.get(key)!.dates.add(row.date);
    }
  });

  return Array.from(grouped.entries()).map(([key, payload]) => {
    const dates = Array.from(payload.dates).sort();
    const assignmentBase = {
      job_id: payload.meta.job_id,
      technician_id: payload.meta.technician_id,
      sound_role: payload.meta.sound_role ?? null,
      lights_role: payload.meta.lights_role ?? null,
      video_role: payload.meta.video_role ?? null,
    };

    return {
      id: `job-${payload.meta.job_id}`,
      job_id: payload.meta.job_id,
      technician_id: payload.meta.technician_id,
      jobs: payload.job,
      department: determineDepartment(payload.meta),
      role: payload.meta.sound_role || payload.meta.lights_role || payload.meta.video_role || "Assigned",
      category: getCategoryFromAssignment(assignmentBase),
      sound_role: assignmentBase.sound_role,
      lights_role: assignmentBase.lights_role,
      video_role: assignmentBase.video_role,
      status: payload.meta.status ?? null,
      assigned_at: payload.meta.assigned_at ?? null,
      covered_dates: dates,
      date_ranges: compressTimesheetDateRanges(dates),
    } satisfies TechnicianAssignment;
  }).sort((a, b) => {
    const firstDateA = a.covered_dates[0] ?? '';
    const firstDateB = b.covered_dates[0] ?? '';
    return firstDateA.localeCompare(firstDateB);
  });
};

const TechnicianDashboard = () => {
  const [timeSpan, setTimeSpan] = useState<string>("1week");
  const [viewMode, setViewMode] = useState<'upcoming' | 'past'>('upcoming');
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldShowMessages = searchParams.get('showMessages') === 'true';
    console.log("Should show messages:", shouldShowMessages);
    setShowMessages(shouldShowMessages);
  }, [location.search]);

  useEffect(() => {
    const fetchUserDepartment = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("No user found");
          return;
        }

        console.log("Fetching profile for user:", user.id);
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile:", error);
          return;
        }

        if (profileData) {
          console.log("User department fetched:", profileData.department);
          setUserDepartment(profileData.department);
        } else {
          console.warn("No profile data found");
        }
      } catch (error) {
        console.error("Error in fetchUserDepartment:", error);
      }
    };

    fetchUserDepartment();
  }, []);

  // Set up comprehensive real-time subscriptions for mobile dashboard
  useTechnicianDashboardSubscriptions();
  
  // Set up tour rates subscriptions
  useTourRateSubscriptions();

  const getTimeSpanEndDate = () => {
    const today = new Date();
    switch (timeSpan) {
      case "1week":
        return viewMode === 'upcoming' ? addWeeks(today, 1) : addWeeks(today, -1);
      case "2weeks":
        return viewMode === 'upcoming' ? addWeeks(today, 2) : addWeeks(today, -2);
      case "1month":
        return viewMode === 'upcoming' ? addMonths(today, 1) : addMonths(today, -1);
      case "3months":
        return viewMode === 'upcoming' ? addMonths(today, 3) : addMonths(today, -3);
      default:
        return viewMode === 'upcoming' ? addWeeks(today, 1) : addWeeks(today, -1);
    }
  };

  // Use our new real-time query hook for fetching assignments
  const { data: assignments = [], isLoading, refetch } = useRealtimeQuery<TechnicianAssignment[]>(
    ['assignments', timeSpan, viewMode],
    async () => {
      try {
        console.log("Fetching assignments with timeSpan:", timeSpan);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("No user found");
          throw new Error("User not authenticated");
        }

        console.log("Fetching assignments for user:", user.id);
        
        const endBoundary = getTimeSpanEndDate();
        const today = new Date();
        const startDate = viewMode === 'upcoming' ? today : endBoundary;
        const endDate = viewMode === 'upcoming' ? endBoundary : today;

        console.log("Fetching assignments between:", startDate, endDate, "viewMode:", viewMode);

        const startIso = startDate.toISOString().split('T')[0];
        const endIso = endDate.toISOString().split('T')[0];

        const { data: timesheetRows, error: timesheetError } = await supabase
          .from('timesheets')
          .select(`
            job_id,
            technician_id,
            date,
            is_schedule_only,
            jobs (
              id,
              title,
              description,
              start_time,
              end_time,
              timezone,
              location_id,
              job_type,
              color,
              status,
              location:locations(name),
              job_documents(
                id,
                file_name,
                file_path,
                visible_to_tech,
                uploaded_at,
                read_only,
                template_type
              )
            )
          `)
          .eq('technician_id', user.id)
          .eq('is_schedule_only', false)
          .gte('date', startIso)
          .lte('date', endIso)
          .order('date', { ascending: viewMode !== 'past' });

        if (timesheetError) {
          console.error("Error fetching timesheets:", timesheetError);
          toast.error("Error loading assignments");
          throw timesheetError;
        }

        const jobIds = Array.from(new Set((timesheetRows || []).map(row => row.job_id))).filter(Boolean) as string[];
        const metadataMap = new Map<string, AssignmentMetadata>();

        if (jobIds.length > 0) {
          const { data: assignmentMetadata, error: assignmentError } = await supabase
            .from('job_assignments')
            .select('job_id, technician_id, sound_role, lights_role, video_role, status, assigned_at')
            .eq('technician_id', user.id)
            .in('job_id', jobIds);

          if (assignmentError) {
            console.error("Error fetching assignment metadata:", assignmentError);
          } else {
            (assignmentMetadata || []).forEach(meta => {
              metadataMap.set(`${meta.job_id}:${meta.technician_id}`, meta);
            });
          }
        }

        const transformedJobs = buildTechnicianAssignmentsFromTimesheets(
          (timesheetRows || []) as TimesheetAssignmentRow[],
          metadataMap
        );

        console.log("Final transformed assignments:", transformedJobs);
        return transformedJobs || [];
      } catch (error) {
        console.error("Error fetching assignments:", error);
        toast.error("No se pudieron cargar las asignaciones");
        return [];
      }
    },
    'timesheets',
    {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 5,
      retry: 3
    }
  );

  const handleCloseMessages = () => {
    setShowMessages(false);
    navigate('/technician-dashboard');
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      console.log("Manually refreshing assignments data");
      await refetch();
      toast.success("Asignaciones actualizadas correctamente");
    } catch (error) {
      console.error("Error refreshing assignments:", error);
      toast.error("No se pudieron actualizar las asignaciones");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    console.log("Current assignments state:", assignments);
    console.log("User department:", userDepartment);
    console.log("isLoading:", isLoading);
    console.log("Assignment count:", assignments?.length);
  }, [assignments, userDepartment, isLoading]);

  // Editing and deletion are not available on technician dashboard

  return (
    <div className="w-full max-w-full space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl md:text-2xl font-semibold">Panel de Técnicos</h1>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            title="Actualizar asignaciones"
            className="shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === 'upcoming' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('upcoming')}
              className="text-xs sm:text-sm"
            >
              Próximas
            </Button>
            <Button
              variant={viewMode === 'past' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('past')}
              className="text-xs sm:text-sm"
            >
              Pasadas
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <TimeSpanSelector 
              value={timeSpan} 
              viewMode={viewMode}
              onValueChange={(value) => {
                console.log("TimeSpan changed to:", value);
                setTimeSpan(value);
              }} 
            />
            <MessageManagementDialog department={userDepartment} />
          </div>
        </div>
      </div>

      {/* My Tours Section */}
      <MyToursSection />

      {/* Tour Rates Section */}
      <TechnicianTourRates />

      {/* My Availability / Unavailability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mi disponibilidad
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Gestiona tus bloques de indisponibilidad para que los gestores no asignen trabajos solapados.
          </div>
          <Button onClick={() => navigate('/dashboard/unavailability')}>
            Gestionar indisponibilidad
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mis asignaciones {viewMode === 'upcoming' ? 'próximas' : 'pasadas'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments && assignments.length > 0 ? (
            <>
              {/* Desktop view */}
              <div className="hidden md:block">
                <AssignmentsGrid 
                  assignments={assignments}
                  loading={isLoading}
                  onRefresh={handleRefresh}
                  techName={userDepartment ? `Técnico de ${userDepartment}` : 'Técnico'}
                />
              </div>
              {/* Mobile view */}
              <div className="block md:hidden">
                <AssignmentsList 
                  assignments={assignments} 
                  loading={isLoading} 
                  onRefresh={handleRefresh}
                  techName={userDepartment ? `Técnico de ${userDepartment}` : 'Técnico'}
                />
              </div>
            </>
          ) : (
            <AssignmentsList 
              assignments={assignments} 
              loading={isLoading} 
              onRefresh={handleRefresh}
              techName={userDepartment ? `Técnico de ${userDepartment}` : 'Técnico'}
            />
          )}
        </CardContent>
      </Card>

      {showMessages && (
        <Dialog open={showMessages} onOpenChange={handleCloseMessages}>
          <DialogContent className="max-w-2xl">
            <MessageManagementDialog department={userDepartment} trigger={false} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TechnicianDashboard;
