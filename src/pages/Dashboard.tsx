
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useJobs } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useDateRange } from "@/context/DateRangeContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { jobsKeys } from "@/lib/query-keys";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DateRangeProvider } from "@/context/DateRangeContext";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { useUserPreferences } from "@/hooks/useUserPreferences";

// Wrap the dashboard content with DateRangeProvider
const DashboardWithDateRange = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]);
  const [timeSpan, setTimeSpan] = useState<string>("1week"); // Default to 1 week view
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, userRole } = useAuth();
  const { preferences } = useUserPreferences();
  const queryClient = useQueryClient();
  const { startDate, endDate, setRangeType } = useDateRange();
  
  // Apply time span from user preferences on component mount
  useEffect(() => {
    if (preferences) {
      const userTimeSpan = preferences?.time_span;
      if (userTimeSpan && userTimeSpan !== timeSpan) {
        setTimeSpan(userTimeSpan);
        setRangeType(userTimeSpan as any);
      }
    }
  }, [preferences, setRangeType, timeSpan]);
  
  // Set time span with handler
  const handleTimeSpanChange = (newTimeSpan: string) => {
    setTimeSpan(newTimeSpan);
    setRangeType(newTimeSpan as any);
  };

  // Fetch jobs based on date range - pass the params object with start and end dates
  const { data: jobs = [], isLoading } = useJobs({
    startDate,
    endDate,
  });
  
  // Set up realtime subscriptions for jobs - using the updated hook signature
  useRealtimeSubscription('jobs', jobsKeys.calendar());

  // Filter jobs for the selected date
  useEffect(() => {
    if (!date || !jobs || !Array.isArray(jobs)) {
      setSelectedJobs([]);
      return;
    }

    const dateStr = format(date, "yyyy-MM-dd");
    const filteredJobs = jobs.filter((job) => {
      const jobStartDate = new Date(job.start_time);
      const jobEndDate = new Date(job.end_time);
      const currentDate = new Date(dateStr);
      
      // Set time to midnight for date comparison
      jobStartDate.setHours(0, 0, 0, 0);
      jobEndDate.setHours(0, 0, 0, 0);
      
      // Check if job is within date range
      return (
        (jobStartDate <= currentDate && jobEndDate >= currentDate) ||
        format(jobStartDate, "yyyy-MM-dd") === dateStr ||
        format(jobEndDate, "yyyy-MM-dd") === dateStr
      );
    });
    
    setSelectedJobs(filteredJobs);
  }, [date, jobs]);

  // Handle job click
  const handleJobClick = (jobId: string) => {
    navigate(`/jobs/view/${jobId}`);
  };

  // Handle job edit
  const handleEditJob = (job: any) => {
    navigate(`/jobs/edit/${job.id}`);
  };

  // Handle job delete
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this job?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("jobs")
        .delete()
        .eq("id", jobId);

      if (error) {
        throw error;
      }

      toast({
        title: "Job deleted",
        description: "The job has been successfully deleted.",
      });

      // Manually update the jobs list
      queryClient.invalidateQueries({ queryKey: jobsKeys.all() });
    } catch (error) {
      console.error("Error deleting job:", error);
      toast({
        title: "Error",
        description: "Failed to delete job. Please try again.",
        variant: "destructive",
      });
    }
    
    return Promise.resolve();
  };
  
  // Handle date type change
  const handleDateTypeChange = () => {
    queryClient.invalidateQueries({ queryKey: jobsKeys.all() });
  };

  return (
    <div className="space-y-8">
      <DashboardHeader 
        timeSpan={timeSpan}
        onTimeSpanChange={handleTimeSpanChange}
      />
      
      <DashboardContent
        date={date}
        setDate={setDate}
        jobs={jobs}
        selectedDateJobs={selectedJobs}
        onEditClick={handleEditJob}
        onDeleteClick={handleDeleteJob}
        onJobClick={handleJobClick}
        userRole={userRole}
        onDateTypeChange={handleDateTypeChange}
      />
    </div>
  );
};

// Export the main Dashboard component
export default function Dashboard() {
  return (
    <DateRangeProvider initialRangeType="1week" initialBaseDate={new Date()}>
      <DashboardWithDateRange />
    </DateRangeProvider>
  );
}
