
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Department } from "@/types/department";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { format } from "date-fns";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { supabase } from "@/lib/supabase";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { getDashboardPath } from "@/utils/roleBasedRouting";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send, ChevronDown } from "lucide-react";
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
import { useOptimizedMessagesSubscriptions } from "@/hooks/useOptimizedSubscriptions";
import { CorporateEmailComposer } from "@/components/emails/CorporateEmailComposer";

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
  const navigate = useNavigate();
  const { userRole: authUserRole, isLoading: authLoading } = useOptimizedAuth();

  // Early security check: Only allow admin, management, logistics
  useEffect(() => {
    if (authLoading) return;

    if (authUserRole && !['admin', 'management', 'logistics'].includes(authUserRole)) {
      const redirectPath = getDashboardPath(authUserRole as any);
      navigate(redirectPath, { replace: true });
    }
  }, [authUserRole, authLoading, navigate]);

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
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);

  // Data fetching with optimized hook
  const { data: jobs, isLoading } = useOptimizedJobs();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Ensure realtime updates for messages are wired
  useOptimizedMessagesSubscriptions(userId || '');

  // No manual subscriptions needed - useOptimizedJobs handles job-related subscriptions

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

  // Show loading state while checking authorization
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-white" />
      </div>
    );
  }

  // Don't render anything if user is unauthorized (they'll be redirected)
  if (!authUserRole || !['admin', 'management', 'logistics'].includes(authUserRole)) {
    return null;
  }

  // Event handlers
  const handleJobClick = (_jobId: string) => {
    // Parity: disable assignment dialog on card click in dashboard
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4 md:space-y-8">
      <DashboardHeader timeSpan={timeSpan} onTimeSpanChange={setTimeSpan} />

      {userRole && ["admin", "management"].includes(userRole) && (
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
            detailsOnlyMode
            hideTasks
          />
        </div>
      </div>

      {userRole && ["admin", "management"].includes(userRole) && (
        <Card className="w-full">
          <CardHeader>
            <Button 
              variant="ghost" 
              className="w-full justify-between p-0 h-auto hover:bg-transparent"
              onClick={() => setEmailComposerOpen(!emailComposerOpen)}
            >
              <CardTitle>Redactar Email Corporativo</CardTitle>
              <ChevronDown className={`h-5 w-5 transition-transform ${emailComposerOpen ? "rotate-180" : ""}`} />
            </Button>
          </CardHeader>
          {emailComposerOpen && (
            <CardContent>
              <CorporateEmailComposer />
            </CardContent>
          )}
        </Card>
      )}

      {/* Assignment dialog intentionally disabled for dashboard parity */}

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
