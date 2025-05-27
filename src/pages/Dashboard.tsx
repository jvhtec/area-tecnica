import { useState, useEffect } from "react";
import { Department } from "@/types/department";
import { useJobs } from "@/hooks/useJobs";
import { format } from "date-fns";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { supabase } from "@/lib/supabase";
import { useDashboardSubscriptions } from "@/hooks/useUnifiedSubscriptions";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TourChips } from "@/components/dashboard/TourChips";
import { MessageSquare, Send, ChevronDown, ChevronUp } from "lucide-react";
import { MessagesList } from "@/components/messages/MessagesList";
import { DirectMessagesList } from "@/components/messages/DirectMessagesList";
import { Button } from "@/components/ui/button";
import { DirectMessageDialog } from "@/components/messages/DirectMessageDialog";
import { isJobOnDate } from "@/utils/timezoneUtils";

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
  const [showTours, setShowTours] = useState(true);
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
  useDashboardSubscriptions();
  
  // Setup subscriptions
  useEffect(() => {
    forceSubscribe([
      'jobs', 
      'job_assignments', 
      'job_date_types', 
      'messages', 
      'direct_messages',
      'tours'
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
          .select("role, tours_expanded")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Error fetching user role and preferences:", error);
          return;
        }

        if (data) {
          setUserRole(data.role);
          setShowTours(data.tours_expanded !== null && data.tours_expanded !== undefined ? data.tours_expanded : true);

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
    console.log("Delete job called from Dashboard");
    // This is handled by the JobCardNew component's delete functionality
  };

  const handleDateTypeChange = () => {
    console.log("Date type change called from Dashboard");
    // This is handled by the CalendarSection component
  };

  const handleToggleTours = async () => {
    const newValue = !showTours;
    setShowTours(newValue);
    if (userId) {
      const { error } = await supabase
        .from("profiles")
        .update({ tours_expanded: newValue })
        .eq("id", userId);
      if (error) {
        console.error("Error updating tours preference:", error);
      }
    }
  };

  const selectedDateJobs = getSelectedDateJobs(date, jobs);

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <DashboardHeader timeSpan={timeSpan} onTimeSpanChange={setTimeSpan} />

      {userRole === "management" && (
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Messages
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewMessageDialogOpen(true)}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                New Message
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
              <div className="space-y-6">
                <MessagesList />
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Direct Messages</h3>
                  <DirectMessagesList />
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="w-full bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Tours {new Date().getFullYear()}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleTours}
            className="h-8 w-8 p-0"
          >
            {showTours ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {showTours && (
          <CardContent>
            <TourChips
              onTourClick={(tourId) => {
                if (userRole === "logistics") return;
                const tour = jobs?.find((job) => job.id === tourId);
                if (tour) handleEditClick(tour);
              }}
            />
          </CardContent>
        )}
      </Card>

      <DashboardContent
        date={date}
        setDate={setDate}
        jobs={jobs}
        selectedDateJobs={selectedDateJobs}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onJobClick={handleJobClick}
        userRole={userRole}
        onDateTypeChange={handleDateTypeChange}
      />

      {selectedJobId && (
        <JobAssignmentDialog
          open={isAssignmentDialogOpen}
          onOpenChange={setIsAssignmentDialogOpen}
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
