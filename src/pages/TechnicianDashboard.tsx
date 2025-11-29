
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addWeeks, addMonths } from "date-fns";
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

  const assignmentsQueryKey = useMemo(
    () => ['assignments', timeSpan, viewMode],
    [timeSpan, viewMode]
  );

  // Set up comprehensive real-time subscriptions for mobile dashboard
  useTechnicianDashboardSubscriptions({ queryKey: assignmentsQueryKey });
  
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
  const { data: assignments = [], isLoading, refetch } = useRealtimeQuery(
    assignmentsQueryKey,
    async () => {
      try {
        console.log("Fetching assignments with timeSpan:", timeSpan);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("No user found");
          throw new Error("User not authenticated");
        }

        console.log("Fetching assignments for user:", user.id);

        const endDate = getTimeSpanEndDate();
        const now = new Date();
        console.log("Fetching assignments until:", endDate, "viewMode:", viewMode);

        // Step 1: Fetch confirmed job assignments to get role/status info
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('job_assignments')
          .select('job_id, sound_role, lights_role, video_role, status, assigned_at')
          .eq('technician_id', user.id)
          .eq('status', 'confirmed');

        if (assignmentsError) {
          console.error("Error fetching job assignments:", assignmentsError);
          toast.error("Error loading assignment roles");
          return [];
        }

        if (!assignmentsData || assignmentsData.length === 0) {
          return [];
        }

        // Create a map for quick role lookup and a list of job IDs to fetch
        const assignmentsByJobId = new Map(
          assignmentsData.map((assignment) => [assignment.job_id, assignment])
        );
        const jobIds = Array.from(new Set(assignmentsData.map((assignment) => assignment.job_id)));

        // Step 2: Fetch timesheets (with jobs) for those assignments to leverage real-time updates
        let timesheetsQuery = supabase
          .from('timesheets')
          .select(`
            job_id,
            technician_id,
            date,
            jobs!inner (
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
          .in('job_id', jobIds);

        if (viewMode === 'upcoming') {
          timesheetsQuery = timesheetsQuery
            .lte('jobs.start_time', endDate.toISOString())
            .gte('jobs.end_time', now.toISOString());
        } else {
          timesheetsQuery = timesheetsQuery
            .lte('jobs.end_time', now.toISOString());
        }

        const { data: timesheetData, error: timesheetError } = await timesheetsQuery
          .order('start_time', { referencedTable: 'jobs' });

        if (timesheetError) {
          console.error("Error fetching assignments:", timesheetError);
          toast.error("Error loading timesheet data");
          return [];
        }

        // Track which jobs we already have via timesheets
        const seenJobIds = new Set<string>();
        const timesheetAssignments = (timesheetData || []).filter(row => {
          if (seenJobIds.has(row.job_id)) return false;
          seenJobIds.add(row.job_id);
          return true;
        });

        // Step 3: Fetch remaining jobs without timesheet rows so they still show up
        const missingJobIds = jobIds.filter((id) => !seenJobIds.has(id));
        let jobsWithoutTimesheets: Array<{ job_id: string; technician_id: string; jobs: typeof timesheetAssignments[number]['jobs'] }> = [];

        if (missingJobIds.length > 0) {
          let jobsQuery = supabase
            .from('jobs')
            .select(`
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
            `)
            .in('id', missingJobIds);

          if (viewMode === 'upcoming') {
            jobsQuery = jobsQuery
              .lte('start_time', endDate.toISOString())
              .gte('end_time', now.toISOString());
          } else {
            jobsQuery = jobsQuery
              .lte('end_time', now.toISOString());
          }

          const { data: jobsData, error: jobsError } = await jobsQuery.order('start_time');

          if (jobsError) {
            console.error("Error fetching jobs without timesheets:", jobsError);
            toast.error("Error loading job details");
            return [];
          }

          jobsWithoutTimesheets = (jobsData || []).map((job) => ({
            job_id: job.id,
            technician_id: user.id,
            jobs: job,
          }));
        }

        // Combine timesheet-backed and job-only assignments
        const combinedAssignments = [...timesheetAssignments, ...jobsWithoutTimesheets];

        const transformedJobs = combinedAssignments
          .filter(assignment => assignment.jobs)
          .map((assignment) => {
            const assignmentInfo = assignmentsByJobId.get(assignment.job_id);
            let department = "unknown";
            if (assignmentInfo?.sound_role) department = "sound";
            else if (assignmentInfo?.lights_role) department = "lights";
            else if (assignmentInfo?.video_role) department = "video";

            // Determine category from the role code
            const category = getCategoryFromAssignment({
              sound_role: assignmentInfo?.sound_role,
              lights_role: assignmentInfo?.lights_role,
              video_role: assignmentInfo?.video_role
            });

            return {
              id: `job-${assignment.job_id}`,
              job_id: assignment.job_id,
              technician_id: assignment.technician_id,
              department,
              role: assignmentInfo?.sound_role || assignmentInfo?.lights_role || assignmentInfo?.video_role || "Assigned",
              category,
              jobs: assignment.jobs
            };
          });

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
