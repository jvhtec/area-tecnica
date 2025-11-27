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
import { MessageSquare, Send, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarSection } from "@/components/dashboard/CalendarSection";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { isJobOnDate } from "@/utils/timezoneUtils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { deleteJobOptimistically } from "@/services/optimisticJobDeletionService";
import { useOptimizedMessagesSubscriptions } from "@/hooks/useOptimizedSubscriptions";
import { MessagesDialog } from "@/components/dashboard/MessagesDialog";
import { EmailComposerDialog } from "@/components/dashboard/EmailComposerDialog";

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

  // Dashboard state
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [timeSpan, setTimeSpan] = useState<string>("1week");

  // Modal state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);

  // New Dialog States
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);

  // Data fetching with optimized hook
  const { data: jobs, isLoading } = useOptimizedJobs();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Ensure realtime updates for messages are wired
  useOptimizedMessagesSubscriptions(userId || '');

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
            setMessagesOpen(true);
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
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      <div className="mx-auto w-full max-w-full space-y-6">
        <DashboardHeader timeSpan={timeSpan} onTimeSpanChange={setTimeSpan} />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Main Content Area */}
          <div className="xl:col-span-8 2xl:col-span-9 space-y-6">
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <CalendarSection
                date={date}
                onDateSelect={setDate}
                jobs={jobs}
                onDateTypeChange={handleDateTypeChange}
              />
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6 xl:col-span-4 2xl:col-span-3">
            {/* Quick Actions */}
            {userRole && ["admin", "management"].includes(userRole) && (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="bg-card border-border hover:bg-accent hover:text-accent-foreground text-foreground/80 h-auto py-4 flex flex-col gap-2"
                  onClick={() => setMessagesOpen(true)}
                >
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                  <span className="text-xs font-medium">Mensajes</span>
                </Button>
                <Button
                  variant="outline"
                  className="bg-card border-border hover:bg-accent hover:text-accent-foreground text-foreground/80 h-auto py-4 flex flex-col gap-2"
                  onClick={() => setEmailComposerOpen(true)}
                >
                  <Mail className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-medium">Email</span>
                </Button>
              </div>
            )}

            {/* Today's Schedule Widget */}
            <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Agenda de Hoy</h3>
                <span className="text-xs text-muted-foreground">{format(new Date(), 'd MMM')}</span>
              </div>
              <div className="p-2">
                <TodaySchedule
                  jobs={selectedDateJobs}
                  onEditClick={handleEditClick}
                  onDeleteClick={handleDeleteClick}
                  onJobClick={handleJobClick}
                  userRole={userRole}
                  selectedDate={date}
                  detailsOnlyMode
                  hideTasks
                  viewMode="sidebar"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        {selectedJob && (
          <EditJobDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            job={selectedJob}
          />
        )}

        <MessagesDialog
          open={messagesOpen}
          onOpenChange={setMessagesOpen}
        />

        <EmailComposerDialog
          open={emailComposerOpen}
          onOpenChange={setEmailComposerOpen}
        />
      </div>
    </div>
  );
};

export default Dashboard;
