
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, FileText, Filter, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { startOfMonth, endOfMonth, addMonths, isToday } from "date-fns";
import { MonthNavigation } from "@/components/project-management/MonthNavigation";
import { DepartmentTabs } from "@/components/project-management/DepartmentTabs";
import { StatusFilter } from "@/components/project-management/StatusFilter";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { autoCompleteJobs } from "@/utils/jobStatusUtils";
import { useToast } from "@/hooks/use-toast";

const ProjectManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("sound");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedJobType, setSelectedJobType] = useState("All");
  const [selectedJobStatuses, setSelectedJobStatuses] = useState<string[]>(["Confirmado", "Tentativa"]);
  const [allJobTypes, setAllJobTypes] = useState<string[]>([]);
  const [allJobStatuses, setAllJobStatuses] = useState<string[]>([]);
  const [highlightToday, setHighlightToday] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const { forceSubscribe } = useSubscriptionContext();

  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  // Use custom hook to keep the "jobs" tab active/visible.
  useTabVisibility(["jobs"]);
  
  // Force subscription to required tables
  useEffect(() => {
    forceSubscribe([
      { table: 'jobs', queryKey: 'jobs' },
      { table: 'job_assignments', queryKey: 'job_assignments' },
      { table: 'job_departments', queryKey: 'job_departments' }
    ]);
  }, [forceSubscribe]);

  // Use optimized jobs hook with built-in filtering and caching
  const { data: optimizedJobs = [], isLoading: jobsLoading, error: jobsError } = useOptimizedJobs(
    selectedDepartment,
    startDate,
    endDate
  );

  // Check user permissions early
  const canCreateItems = ['admin', 'management', 'logistics'].includes(userRole || '');

  // Auto-complete past jobs when data loads
  useEffect(() => {
    const handleAutoComplete = async () => {
      if (!optimizedJobs?.length || !canCreateItems) return;
      
      setIsAutoCompleting(true);
      try {
        const { updatedJobs, updatedCount } = await autoCompleteJobs(optimizedJobs);
        
        if (updatedCount > 0) {
          toast({
            title: "Jobs Auto-Completed",
            description: `${updatedCount} past job(s) automatically marked as completed`,
          });
        }
      } catch (error) {
        console.error('Auto-complete error:', error);
      } finally {
        setIsAutoCompleting(false);
      }
    };

    handleAutoComplete();
  }, [optimizedJobs, canCreateItems, toast]);

  // Filter jobs by selected job type and statuses with database-level optimization
  const jobs = (optimizedJobs || []).filter((job: any) => {
    const matchesType = selectedJobType === "All" || job.job_type?.toLowerCase() === selectedJobType.toLowerCase();
    const matchesStatus = selectedJobStatuses.length === 0 || selectedJobStatuses.includes(job.status);
    return matchesType && matchesStatus;
  });

  // Highlight today's jobs when page loads
  useEffect(() => {
    if (!loading && jobs.length > 0) {
      const todayJobs = jobs.filter((job: any) => {
        const jobStart = new Date(job.start_time);
        const jobEnd = new Date(job.end_time);
        const today = new Date();
        return today >= jobStart && today <= jobEnd;
      });

      if (todayJobs.length > 0) {
        setHighlightToday(true);
        // Remove highlight after 3 seconds
        setTimeout(() => setHighlightToday(false), 3000);
      }
    }
  }, [loading, jobs]);

  // Check user access and fetch profile role.
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log("ProjectManagement: No session found, redirecting to auth");
          navigate("/auth");
          return;
        }
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profileError) {
          console.error("ProjectManagement: Error fetching profile:", profileError);
          throw profileError;
        }
        // Allow technicians to view but not modify festival jobs
        if (!profile || !["admin", "logistics", "management", "technician"].includes(profile.role)) {
          console.log("ProjectManagement: Unauthorized access attempt");
          navigate("/dashboard");
          return;
        }
        setUserRole(profile.role);
        setLoading(false);
      } catch (error) {
        console.error("ProjectManagement: Error in access check:", error);
        navigate("/dashboard");
      }
    };

    checkAccess();
  }, [navigate]);

  // Load user preferences for job status selection
  useEffect(() => {
    const loadUserPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("selected_job_statuses")
          .eq("id", session.user.id)
          .single();
          
        if (error) {
          console.error("Error loading user preferences:", error);
          return;
        }
        
        if (profile?.selected_job_statuses) {
          setSelectedJobStatuses(profile.selected_job_statuses);
        }
      } catch (error) {
        console.error("Error in loadUserPreferences:", error);
      }
    };
    
    loadUserPreferences();
  }, []);

  // Save user preferences when status selection changes
  const saveUserPreferences = async (statuses: string[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      
      const { error } = await supabase
        .from("profiles")
        .update({ selected_job_statuses: statuses })
        .eq("id", session.user.id);
        
      if (error) {
        console.error("Error saving user preferences:", error);
      }
    } catch (error) {
      console.error("Error in saveUserPreferences:", error);
    }
  };

  // Extract job types and statuses from optimized jobs data to avoid extra query
  useEffect(() => {
    if (optimizedJobs?.length > 0) {
      const types = Array.from(
        new Set(optimizedJobs
          .map((job: any) => job.job_type)
          .filter(Boolean))
      );
      const statuses = Array.from(
        new Set(optimizedJobs
          .map((job: any) => job.status)
          .filter(Boolean))
      );
      setAllJobTypes(types);
      setAllJobStatuses(statuses);
    }
  }, [optimizedJobs]);

  if (loading || jobsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Check if user has permissions to create new items
  // (Already declared above for use in useEffect)

  const handleAutoCompleteAll = async () => {
    if (!canCreateItems) return;
    
    setIsAutoCompleting(true);
    try {
      const { updatedJobs, updatedCount } = await autoCompleteJobs(optimizedJobs);
      
      if (updatedCount > 0) {
        toast({
          title: "Jobs Auto-Completed",
          description: `${updatedCount} past job(s) marked as completed`,
        });
      } else {
        toast({
          title: "No Updates Needed",
          description: "All past jobs are already completed or cancelled",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to auto-complete jobs",
        variant: "destructive"
      });
    } finally {
      setIsAutoCompleting(false);
    }
  };

  const handleJobStatusSelection = (status: string) => {
    const newStatuses = selectedJobStatuses.includes(status)
      ? selectedJobStatuses.filter(s => s !== status)
      : [...selectedJobStatuses, status];
      
    setSelectedJobStatuses(newStatuses);
    saveUserPreferences(newStatuses);
  };

  return (
    <div className="container mx-auto px-4 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Project Management</CardTitle>
          <div className="flex gap-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedJobType}
                  onChange={(e) => setSelectedJobType(e.target.value)}
                  className="border border-gray-300 rounded-md py-1 px-2 text-sm"
                >
                  <option value="All">All Types</option>
                  {allJobTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <StatusFilter
                allJobStatuses={allJobStatuses}
                selectedJobStatuses={selectedJobStatuses}
                onStatusSelection={handleJobStatusSelection}
              />
            </div>
            {canCreateItems && (
              <>
                <Button 
                  onClick={handleAutoCompleteAll}
                  disabled={isAutoCompleting || jobsLoading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {isAutoCompleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Auto-Complete Past Jobs
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <MonthNavigation
            currentDate={currentDate}
            onPreviousMonth={() => setCurrentDate(prev => addMonths(prev, -1))}
            onNextMonth={() => setCurrentDate(prev => addMonths(prev, 1))}
          />
          <DepartmentTabs
            selectedDepartment={selectedDepartment}
            onDepartmentChange={(value) => setSelectedDepartment(value as Department)}
            jobs={jobs}
            jobsLoading={jobsLoading}
            onDeleteDocument={undefined} // Will be handled by optimized jobs hook
            userRole={userRole}
            highlightToday={highlightToday}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectManagement;
