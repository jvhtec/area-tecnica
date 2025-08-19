
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addWeeks, addMonths } from "date-fns";
import { TimeSpanSelector } from "@/components/technician/TimeSpanSelector";
import { MessageManagementDialog } from "@/components/technician/MessageManagementDialog";
import { AssignmentsList } from "@/components/technician/AssignmentsList";
import { MyToursSection } from "@/components/technician/MyToursSection";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { useTableSubscription } from "@/hooks/useSubscription";
import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";

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

  // Set up real-time subscription for job assignments
  useTableSubscription('job_assignments', 'assignments');

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
        
        const endDate = getTimeSpanEndDate();
        console.log("Fetching assignments until:", endDate, "viewMode:", viewMode);
        
        let query = supabase
          .from('job_assignments')
          .select(`
            job_id,
            technician_id,
            sound_role,
            lights_role,
            video_role,
            assigned_at,
            jobs (
              id,
              title,
              description,
              start_time,
              end_time,
              location_id,
              job_type,
              color,
              status,
              location:locations(name),
              job_documents(
                id,
                file_name,
                file_path,
                uploaded_at
              )
            )
          `)
          .eq('technician_id', user.id);

        if (viewMode === 'upcoming') {
          // Show upcoming and ongoing jobs
          query = query
            .lte('jobs.start_time', endDate.toISOString())
            .gte('jobs.end_time', new Date().toISOString());
        } else {
          // Show past jobs
          query = query
            .gte('jobs.start_time', endDate.toISOString())
            .lte('jobs.end_time', new Date().toISOString());
        }

        const { data: jobAssignments, error: jobAssignmentsError } = await query
          .order('jobs(start_time)');

        if (jobAssignmentsError) {
          console.error("Error fetching job assignments:", jobAssignmentsError);
          toast.error("Error loading assignments");
          throw jobAssignmentsError;
        }

        console.log("Fetched job assignments:", jobAssignments || []);
        
        const transformedJobs = jobAssignments
          .filter(assignment => assignment.jobs)
          .map(assignment => {
            let department = "unknown";
            if (assignment.sound_role) department = "sound";
            else if (assignment.lights_role) department = "lights";
            else if (assignment.video_role) department = "video";
            
            return {
              id: `job-${assignment.job_id}`,
              job_id: assignment.job_id,
              technician_id: assignment.technician_id,
              department,
              role: assignment.sound_role || assignment.lights_role || assignment.video_role || "Assigned",
              jobs: assignment.jobs
            };
          });
        
        console.log("Final transformed assignments:", transformedJobs);
        return transformedJobs || [];
      } catch (error) {
        console.error("Error fetching assignments:", error);
        toast.error("Failed to load assignments");
        return [];
      }
    },
    'job_assignments',
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
      toast.success("Assignments refreshed successfully");
    } catch (error) {
      console.error("Error refreshing assignments:", error);
      toast.error("Failed to refresh assignments");
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

  const handleJobClick = (jobId: string) => {
    console.log("Job clicked:", jobId);
    
    const job = assignments.find(a => a.job_id === jobId);
    
    if (!job) {
      console.log("Job not found in assignments", jobId);
      return;
    }
    
    console.log("Found job:", job);
    
    const isFestivalJob = job.jobs && 
      (typeof job.jobs === 'object' && 'job_type' in job.jobs) && 
      job.jobs.job_type === 'festival';
    
    console.log("Is festival job:", isFestivalJob);
    
    if (isFestivalJob) {
      navigate(`/festival-management/${jobId}`);
    }
  };

  const handleEditClick = (job: any) => {
    console.log("Edit job clicked:", job);
  };

  const handleDeleteClick = (jobId: string) => {
    console.log("Delete job clicked:", jobId);
  };

  return (
    <div className="w-full max-w-full space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl md:text-2xl font-semibold">Technician Dashboard</h1>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            title="Refresh assignments"
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
              Upcoming
            </Button>
            <Button
              variant={viewMode === 'past' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('past')}
              className="text-xs sm:text-sm"
            >
              Past
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My {viewMode === 'upcoming' ? 'Upcoming' : 'Past'} Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments && assignments.length > 0 ? (
            <TodaySchedule 
              jobs={assignments} 
              onEditClick={handleEditClick} 
              onDeleteClick={handleDeleteClick} 
              onJobClick={handleJobClick} 
              userRole="technician"
              isLoading={isLoading}
              hideTasks={true}
            />
          ) : (
            <AssignmentsList 
              assignments={assignments} 
              loading={isLoading} 
              onRefresh={handleRefresh}
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
