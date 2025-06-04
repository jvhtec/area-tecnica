
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
    console.log("Delete job called from Dashboard");
    // This is handled by the JobCardNew component's delete functionality
  };

  const handleDateTypeChange = () => {
    console.log("Date type change called from Dashboard");
    // This is handled by the CalendarSection component
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

      <div className="space-y-8">
        {/* Calendar section - full width */}
        <div className="w-full">
          <CalendarSection 
            date={date} 
            onDateSelect={setDate} 
            jobs={jobs} 
            onDateTypeChange={handleDateTypeChange}
          />
        </div>
        
        {/* Today's Schedule below the calendar */}
        <div className="w-full">
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
