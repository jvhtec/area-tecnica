import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { addWeeks, addMonths } from "date-fns";
import { TimeSpanSelector } from "@/components/technician/TimeSpanSelector";
import { MessageManagementDialog } from "@/components/technician/MessageManagementDialog";
import { AssignmentsList } from "@/components/technician/AssignmentsList";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog } from "@/components/ui/dialog";
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

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const shouldShowMessages = searchParams.get('showMessages') === 'true';
    setShowMessages(shouldShowMessages);
  }, [location.search]);

  useEffect(() => {
    const fetchUserDepartment = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('department')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setUserDepartment(profileData.department);
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

  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['assignments', timeSpan],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        console.log("Fetching assignments for user:", user.id);
        console.log("Current timeSpan:", timeSpan);
        
        const endDate = getTimeSpanEndDate();
        console.log("Fetching assignments until:", endDate);
        
        const { data, error } = await supabase
          .from('job_assignments')
          .select(`
            *,
            jobs!inner (
              *,
              location:locations(name),
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

        if (error) {
          console.error("Error fetching assignments:", error);
          throw error;
        }
        
        console.log("Fetched assignments:", data);
        return data || [];
      } catch (error) {
        console.error("Error fetching assignments:", error);
        return [];
      }
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true
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
          <AssignmentsList assignments={assignments} loading={isLoading} />
        </CardContent>
      </Card>

      {showMessages && (
        <Dialog open={showMessages} onOpenChange={handleCloseMessages}>
          <MessageManagementDialog department={userDepartment} trigger={false} />
        </Dialog>
      )}
    </div>
  );
};

export default TechnicianDashboard;
