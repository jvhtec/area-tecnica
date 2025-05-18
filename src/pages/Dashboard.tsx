
import { useState, useEffect, useCallback } from "react";
import { Department } from "@/types/department";
import { useJobs } from "@/hooks/useJobs";
import { isWithinInterval } from "date-fns";
import { JobAssignmentDialog } from "@/components/jobs/JobAssignmentDialog";
import { EditJobDialog } from "@/components/jobs/EditJobDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { TourChips } from "@/components/dashboard/TourChips";
import { MessageSquare, Send, ChevronDown, ChevronUp } from "lucide-react";
import { MessagesList } from "@/components/messages/MessagesList";
import { DirectMessagesList } from "@/components/messages/DirectMessagesList";
import { Button } from "@/components/ui/button";
import { DirectMessageDialog } from "@/components/messages/DirectMessageDialog";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { useDateRange, DateRangeProvider } from "@/context/DateRangeContext";
import { getStartOfDay, getEndOfDay } from "@/lib/date-utils";
import { jobsKeys, messagesKeys, toursKeys } from "@/lib/query-keys";

// Memoized function to get jobs for a selected date
const getSelectedDateJobs = (date: Date | undefined, jobs: any[]) => {
  if (!date || !jobs) return [];
  
  const selectedDate = getStartOfDay(date);
  
  return jobs.filter(job => {
    if (job.job_type === 'tour') return false;
    
    const jobStartDate = getStartOfDay(job.start_time);
    const jobEndDate = getEndOfDay(job.end_time);
    
    return isWithinInterval(selectedDate, {
      start: jobStartDate,
      end: jobEndDate
    });
  });
};

const DashboardContent = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("sound");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showTours, setShowTours] = useState(true);
  const [showMessages, setShowMessages] = useState(false);
  const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);

  const { data: jobs, isLoading } = useJobs();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { forceSubscribe } = useSubscriptionContext();
  const { rangeType, setRangeType } = useDateRange();
  
  // Setup necessary subscriptions
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

  // Load user profile data
  useEffect(() => {
    const fetchUserRoleAndPrefs = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user?.id) {
          setUserId(session.user.id);
          
          // Use query client to avoid duplicate fetch
          const cachedProfile = queryClient.getQueryData(['profiles', 'detail', session.user.id]);
          
          if (cachedProfile) {
            // Use cached profile data if available
            setUserRole(cachedProfile.role);
            setShowTours(cachedProfile.tours_expanded ?? true);
          } else {
            // Fetch profile data if not cached
            const { data, error } = await supabase
              .from("profiles")
              .select("role, tours_expanded, time_span")
              .eq("id", session.user.id)
              .single();

            if (error) {
              console.error("Error fetching user role and preferences:", error);
              return;
            }

            if (data) {
              setUserRole(data.role);
              setShowTours(data.tours_expanded !== null && data.tours_expanded !== undefined ? data.tours_expanded : true);
              
              // Set time span from user preferences
              if (data.time_span) {
                setRangeType(data.time_span as any);
              }
              
              // Cache the profile data
              queryClient.setQueryData(['profiles', 'detail', session.user.id], data);
            }
          }
          
          // Check for message URL parameter
          const params = new URLSearchParams(window.location.search);
          if (params.get("showMessages") === "true") {
            setShowMessages(true);
          }
        }
      } catch (error) {
        console.error("Error in fetchUserRoleAndPrefs:", error);
      }
    };

    fetchUserRoleAndPrefs();
  }, [queryClient, setRangeType]);

  // Job interaction handlers
  const handleJobClick = useCallback((jobId: string) => {
    if (userRole === "logistics") return;
    setSelectedJobId(jobId);
    setIsAssignmentDialogOpen(true);
  }, [userRole]);

  const handleEditClick = useCallback((job: any) => {
    if (userRole === "logistics") return;
    setSelectedJob(job);
    setIsEditDialogOpen(true);
  }, [userRole]);

  const handleDeleteClick = useCallback(async (jobId: string) => {
    if (userRole === "logistics") return;

    if (!window.confirm("Are you sure you want to delete this job?")) return;

    try {
      console.log("Starting job deletion process for job:", jobId);

      // Optimize delete operations by using Promise.all for parallel operations
      await Promise.all([
        supabase
          .from("job_assignments")
          .delete()
          .eq("job_id", jobId),
          
        supabase
          .from("job_departments")
          .delete()
          .eq("job_id", jobId)
      ]);
      
      // Delete the job last
      const { error: jobError } = await supabase
        .from("jobs")
        .delete()
        .eq("job_id", jobId);

      if (jobError) throw jobError;

      toast({
        title: "Job deleted successfully",
        description: "The job and all related records have been removed.",
      });

      // Use specific query invalidation
      queryClient.invalidateQueries({ queryKey: jobsKeys.all() });
    } catch (error: any) {
      console.error("Error in deletion process:", error);
      toast({
        title: "Error deleting job",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [queryClient, toast, userRole]);

  // Invalidate queries when date types change
  const handleDateTypeChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: jobsKeys.all() });
  }, [queryClient]);

  // Get jobs for selected date
  const selectedDateJobs = getSelectedDateJobs(date, jobs || []);

  // Toggle tours visibility and save preference
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

  return (
    <div className="container mx-auto px-4 py-6 space-y-8">
      <DashboardHeader />

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

// Wrap the Dashboard with DateRangeProvider
const Dashboard = () => {
  return (
    <DateRangeProvider>
      <DashboardContent />
    </DateRangeProvider>
  );
};

export default Dashboard;
