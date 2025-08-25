
import { useState, useEffect } from "react";
import { Department } from "@/types/department";
import { useJobs } from "@/hooks/useJobs";
import { format } from "date-fns";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { supabase } from "@/lib/supabase";
import { useDashboardSubscriptions } from "@/hooks/useUnifiedSubscriptions";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send } from "lucide-react";
import { MessagesList } from "@/components/messages/MessagesList";
import { DirectMessagesList } from "@/components/messages/DirectMessagesList";
import { Button } from "@/components/ui/button";
import { DirectMessageDialog } from "@/components/messages/DirectMessageDialog";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { isJobOnDate } from "@/utils/timezoneUtils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";

const getSelectedDateJobs = (date: Date | undefined, jobs: any[]) => {
  if (!date || !jobs) return [];
  
  return jobs.filter(job => {
    if (job.job_type === 'tour') return false;
    
    // Use timezone-aware date comparison
    const jobTimezone = job.timezone || 'Europe/Madrid';
    return isJobOnDate(job.start_time, job.end_time, date, jobTimezone);
  });
};

const Dashboard = () => {
  // User data & preferences
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  
  // Dashboard state
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [timeSpan, setTimeSpan] = useState<string>("1week");
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("sound");
  
  // Modal state
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // Data fetching
  const { data: jobs, isLoading } = useJobs();
  const { forceSubscribe } = useSubscriptionContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  useDashboardSubscriptions();
  
  // Setup subscriptions
  useEffect(() => {
    forceSubscribe([
      'jobs', 
      'job_assignments', 
      'job_date_types', 
      'messages', 
      'direct_messages'
    ]);
  }, [forceSubscribe]);

  // Fetch user data
  useEffect(() => {
    const fetchUserRoleAndPrefs = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Error fetching user role:", error);
          return;
        }

        if (data) {
          setUserRole(data.role);

          const params = new URLSearchParams(window.location.search);
          if (params.get("showMessages") === "true") {
            setShowMessages(true);
          }
        }
      }
    };

    fetchUserRoleAndPrefs();
  }, []);

  // Event handlers
  const handleJobClick = (jobId: string) => {
    if (userRole === "logistics") return;
    setSelectedJobId(jobId);
    setIsAssignmentDialogOpen(true);
  };

  const handleEditClick = (job: any) => {
    if (userRole === "logistics") return;
    setSelectedJob(job);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = async (jobId: string) => {
    // Check permissions
    if (!["admin", "management"].includes(userRole || "")) {
      toast({
        title: "Permission denied",
        description: "Only admin and management users can delete jobs",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this job? This action cannot be undone and will remove all related data.")) return;

    try {
      console.log("Dashboard: Starting optimistic job deletion for:", jobId);
      
      // Call optimistic deletion service
      const result = await deleteJobOptimistically(jobId);
      
      if (result.success) {
        toast({
          title: "Job deleted",
          description: result.details || "The job has been removed and cleanup is running in background."
        });
        
        // Invalidate queries to refresh the list
        await queryClient.invalidateQueries({ queryKey: ["jobs"] });
      } else {
        throw new Error(result.error || "Unknown deletion error");
      }
    } catch (error: any) {
      console.error("Dashboard: Error in optimistic job deletion:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDateTypeChange = () => {
    console.log("Date type change called from Dashboard");
    // This is handled by the CalendarSection component
  };

  const selectedDateJobs = getSelectedDateJobs(date, jobs);

  return (
    <div className="space-y-4 md:space-y-8 w-full max-w-full">
      <DashboardHeader timeSpan={timeSpan} onTimeSpanChange={setTimeSpan} />

      {userRole === "management" && (
        <Card className="w-full">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />
              Messages
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewMessageDialogOpen(true)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">New Message</span>
                <span className="sm:hidden">New</span>
              </Button>
              <button
                onClick={() => setShowMessages(!showMessages)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {showMessages ? "Hide" : "Show"}
              </button>
            </div>
          </CardHeader>
          {showMessages && (
            <CardContent>
              <div className="space-y-4 md:space-y-6">
                <MessagesList />
                <div className="border-t pt-4 md:pt-6">
                  <h3 className="text-base md:text-lg font-medium mb-4">Direct Messages</h3>
                  <DirectMessagesList />
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <div className="space-y-4 md:space-y-8">
        {/* Calendar section - full width */}
        <div className="w-full">
          <CalendarSection 
            date={date} 
            onDateSelect={setDate} 
            jobs={jobs} 
            onDateTypeChange={handleDateTypeChange}
          />
        </div>
        
        {/* Today's Schedule below the calendar - Hidden on mobile */}
        <div className="w-full hidden md:block">
          <TodaySchedule
            jobs={selectedDateJobs}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            onJobClick={handleJobClick}
            userRole={userRole}
            selectedDate={date}
          />
        </div>
      </div>

      {selectedJobId && (
        <JobAssignmentDialog
          isOpen={isAssignmentDialogOpen}
          onClose={() => setIsAssignmentDialogOpen(false)}
          onAssignmentChange={() => {}}
          jobId={selectedJobId}
          department={selectedDepartment}
        />
      )}

      {selectedJob && (
        <EditJobDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          job={selectedJob}
        />
      )}

      <DirectMessageDialog
        open={newMessageDialogOpen}
        onOpenChange={setNewMessageDialogOpen}
      />
    </div>
  );
};

export default Dashboard;
