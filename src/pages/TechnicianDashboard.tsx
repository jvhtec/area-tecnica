
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addWeeks, addMonths } from "date-fns";
import { TimeSpanSelector } from "@/components/technician/TimeSpanSelector";
import { MessageManagementDialog } from "@/components/technician/MessageManagementDialog";
import { AssignmentsList } from "@/components/technician/AssignmentsList";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TechnicianDashboard = () => {
  const [timeSpan, setTimeSpan] = useState<string>("1week");
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Set up UI effects for showing messages dialog
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldShowMessages = searchParams.get('showMessages') === 'true';
    console.log("Should show messages:", shouldShowMessages);
    setShowMessages(shouldShowMessages);
  }, [location.search]);

  // Fetch user department
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
  useEffect(() => {
    console.log("Setting up real-time subscription for assignments");
    
    const channel = supabase
      .channel('assignments_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_assignments'
        },
        (payload) => {
          console.log("Received real-time update:", payload);
          // Invalidate and refetch assignments
          queryClient.invalidateQueries({ queryKey: ['assignments'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'festival_assignments'
        },
        (payload) => {
          console.log("Received real-time update for festival assignments:", payload);
          queryClient.invalidateQueries({ queryKey: ['assignments'] });
        }
      )
      .subscribe();

    return () => {
      console.log("Cleaning up real-time subscription");
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getTimeSpanEndDate = () => {
    const today = new Date();
    switch (timeSpan) {
      case "1week":
        return addWeeks(today, 1);
      case "2weeks":
        return addWeeks(today, 2);
      case "1month":
        return addMonths(today, 1);
      case "3months":
        return addMonths(today, 3);
      default:
        return addWeeks(today, 1);
    }
  };

  // Fetch assignments data
  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['assignments', timeSpan, userDepartment],
    queryFn: async () => {
      try {
        console.log("Fetching assignments with timeSpan:", timeSpan, "and department:", userDepartment);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("No user found");
          throw new Error("User not authenticated");
        }

        console.log("Fetching assignments for user:", user.id);
        
        const endDate = getTimeSpanEndDate();
        console.log("Fetching assignments until:", endDate);
        
        // Fetch regular job assignments
        const { data: regularAssignments, error: regularError } = await supabase
          .from('job_assignments')
          .select(`
            id,
            job_id,
            technician_id,
            sound_role,
            lights_role,
            video_role,
            created_at,
            jobs!inner (
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
              job_departments(department),
              job_documents(
                id,
                file_name,
                file_path,
                uploaded_at
              )
            )
          `)
          .eq('technician_id', user.id)
          .gte('jobs.start_time', new Date().toISOString())
          .lte('jobs.start_time', endDate.toISOString())
          .order('jobs(start_time)', { ascending: true });

        if (regularError) {
          console.error("Error fetching regular assignments:", regularError);
          toast.error("Error loading assignments");
        }

        console.log("Fetched regular assignments:", regularAssignments || []);
        
        // Fetch festival assignments
        const { data: festivalAssignments, error: festivalError } = await supabase
          .from('festival_assignments')
          .select(`
            id,
            technician_id,
            festival_job_id,
            role,
            created_at,
            festival_jobs(
              id,
              title,
              festival_id,
              festival_stage_id,
              day,
              start_time,
              end_time,
              color,
              festival(name, start_date, end_date),
              festival_stage(name),
              job_documents(
                id,
                file_name,
                file_path,
                uploaded_at
              )
            )
          `)
          .eq('technician_id', user.id)
          .order('created_at', { ascending: false });

        if (festivalError) {
          console.error("Error fetching festival assignments:", festivalError);
          toast.error("Error loading festival assignments");
        }

        console.log("Fetched festival assignments:", festivalAssignments || []);
        
        // Combine both types of assignments
        let allAssignments = [];
        
        if (regularAssignments) {
          allAssignments = [...regularAssignments];
        }
        
        if (festivalAssignments) {
          // Transform festival assignments to match the structure expected by the AssignmentsList component
          const transformedFestivalAssignments = festivalAssignments.map(assignment => ({
            id: assignment.id,
            job_id: assignment.festival_job_id,
            technician_id: assignment.technician_id,
            festival_jobs: assignment.festival_jobs
          }));
          
          allAssignments = [...allAssignments, ...transformedFestivalAssignments];
        }
        
        console.log("Combined assignments:", allAssignments);
        console.log("Combined assignments count:", allAssignments.length);
        
        // Filter assignments based on user department if available
        if (userDepartment && allAssignments.length > 0) {
          console.log("Filtering assignments by department:", userDepartment);
          
          const filteredData = allAssignments.filter(assignment => {
            // For regular jobs
            if (assignment.jobs && assignment.jobs.job_departments) {
              return assignment.jobs.job_departments.some(
                (dept: any) => dept.department.toLowerCase() === userDepartment.toLowerCase()
              );
            }
            
            // For festival jobs
            if (assignment.festival_jobs) {
              // Festival jobs will be shown to all relevant department technicians
              return true;
            }
            
            return false;
          });
          
          console.log("Filtered assignments:", filteredData);
          console.log("Filtered assignments count:", filteredData.length);
          return filteredData || [];
        }
        
        return allAssignments || [];
      } catch (error) {
        console.error("Error fetching assignments:", error);
        toast.error("Failed to load assignments");
        return [];
      }
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
    retry: 3
  });

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

  // Debug output
  useEffect(() => {
    console.log("Current assignments state:", assignments);
    console.log("User department:", userDepartment);
    console.log("isLoading:", isLoading);
    console.log("Assignment count:", assignments?.length);
  }, [assignments, userDepartment, isLoading]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Technician Dashboard</h1>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            title="Refresh assignments"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <TimeSpanSelector 
            value={timeSpan} 
            onValueChange={(value) => {
              console.log("TimeSpan changed to:", value);
              setTimeSpan(value);
            }} 
          />
          <MessageManagementDialog department={userDepartment} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            My Upcoming Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AssignmentsList 
            assignments={assignments} 
            loading={isLoading} 
            onRefresh={handleRefresh}
          />
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
