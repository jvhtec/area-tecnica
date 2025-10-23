
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import { MonthNavigation } from "@/components/project-management/MonthNavigation";
import { DepartmentTabs } from "@/components/project-management/DepartmentTabs";
import { StatusFilter } from "@/components/project-management/StatusFilter";
import { JobTypeFilter } from "@/components/project-management/JobTypeFilter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { autoCompleteJobs } from "@/utils/jobStatusUtils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileProjectFilters } from "@/components/project-management/MobileProjectFilters";

interface ProjectManagementHeaderProps {
  isMobile: boolean;
  allJobTypes: string[];
  selectedJobTypes: string[];
  onTypeToggle: (type: string) => void;
  allJobStatuses: string[];
  selectedJobStatuses: string[];
  onStatusSelection: (status: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  jobsLoading: boolean;
  canCreateItems: boolean;
  onAutoCompleteAll: () => void;
  isAutoCompleting: boolean;
}

const ProjectManagementHeader = ({
  isMobile,
  allJobTypes,
  selectedJobTypes,
  onTypeToggle,
  allJobStatuses,
  selectedJobStatuses,
  onStatusSelection,
  searchQuery,
  onSearchQueryChange,
  jobsLoading,
  canCreateItems,
  onAutoCompleteAll,
  isAutoCompleting,
}: ProjectManagementHeaderProps) => {
  const allTypesSelected = allJobTypes.length > 0 && selectedJobTypes.length === allJobTypes.length;
  const typeSummary = selectedJobTypes.length === 0 || allTypesSelected
    ? "All types"
    : `${selectedJobTypes.length} selected`;

  const allStatusesSelected = allJobStatuses.length > 0 && selectedJobStatuses.length === allJobStatuses.length;
  const statusSummary = selectedJobStatuses.length === 0 || allStatusesSelected
    ? "All statuses"
    : `${selectedJobStatuses.length} selected`;

  const autoCompleteButton = canCreateItems ? (
    <Button
      onClick={onAutoCompleteAll}
      disabled={isAutoCompleting || jobsLoading}
      variant="outline"
      size={isMobile ? "default" : "sm"}
      className={`flex items-center gap-2 ${isMobile ? "w-full justify-center" : ""}`}
    >
      {isAutoCompleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle className="h-4 w-4" />
      )}
      Auto-Complete Past Jobs
    </Button>
  ) : null;

  if (isMobile) {
    return (
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Project Management</CardTitle>
          <MobileProjectFilters
            allJobTypes={allJobTypes}
            selectedJobTypes={selectedJobTypes}
            onTypeToggle={onTypeToggle}
            allJobStatuses={allJobStatuses}
            selectedJobStatuses={selectedJobStatuses}
            onStatusSelection={onStatusSelection}
            searchQuery={searchQuery}
            onSearchQueryChange={onSearchQueryChange}
            jobsLoading={jobsLoading}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="text-xs font-medium">
            Types: {typeSummary}
          </Badge>
          <Badge variant="secondary" className="text-xs font-medium">
            Status: {statusSummary}
          </Badge>
          {searchQuery && (
            <Badge variant="outline" className="text-xs font-medium">
              Search: “{searchQuery}”
            </Badge>
          )}
        </div>

        {autoCompleteButton && <div className="w-full">{autoCompleteButton}</div>}
      </CardHeader>
    );
  }

  return (
    <CardHeader className="space-y-4 pb-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle>Project Management</CardTitle>
        {autoCompleteButton}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <JobTypeFilter
          allJobTypes={allJobTypes}
          selectedJobTypes={selectedJobTypes}
          onTypeToggle={onTypeToggle}
        />
        <StatusFilter
          allJobStatuses={allJobStatuses}
          selectedJobStatuses={selectedJobStatuses}
          onStatusSelection={onStatusSelection}
        />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search projects..."
            className="h-8 w-[220px] pl-8"
          />
          {jobsLoading && (
            <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
    </CardHeader>
  );
};

interface ProjectManagementContentProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  selectedDepartment: Department;
  onDepartmentChange: (value: string) => void;
  jobs: any[];
  jobsLoading: boolean;
  highlightToday: boolean;
}

const ProjectManagementContent = ({
  currentDate,
  onPreviousMonth,
  onNextMonth,
  selectedDepartment,
  onDepartmentChange,
  jobs,
  jobsLoading,
  highlightToday,
}: ProjectManagementContentProps) => {
  return (
    <CardContent className="space-y-6">
      <MonthNavigation
        currentDate={currentDate}
        onPreviousMonth={onPreviousMonth}
        onNextMonth={onNextMonth}
      />
      <DepartmentTabs
        selectedDepartment={selectedDepartment}
        onDepartmentChange={onDepartmentChange}
        jobs={jobs}
        jobsLoading={jobsLoading}
        highlightToday={highlightToday}
      />
    </CardContent>
  );
};

const ProjectManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("sound");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedJobStatuses, setSelectedJobStatuses] = useState<string[]>(["Confirmado", "Tentativa"]);
  const [allJobTypes, setAllJobTypes] = useState<string[]>([]);
  const [allJobStatuses, setAllJobStatuses] = useState<string[]>([]);
  const [highlightToday, setHighlightToday] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { forceSubscribe } = useSubscriptionContext();
  const isMobile = useIsMobile();

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

  // Debounce search input to avoid thrashing queries and re-renders
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // When searching, override month pagination by removing date bounds
  const isSearching = debouncedQuery.trim().length > 0;

  // Use optimized jobs hook with built-in filtering and caching
  const { data: optimizedJobs = [], isLoading: jobsLoading } = useOptimizedJobs(
    selectedDepartment,
    isSearching ? undefined : startDate,
    isSearching ? undefined : endDate,
    true // include dryhire jobs in project management
  );

  // Check user permissions early
  const canCreateItems = ['admin', 'management', 'logistics'].includes(userRole || '');

  // Auto-complete past jobs when data loads
  useEffect(() => {
    const handleAutoComplete = async () => {
      // Skip auto-complete while searching (prevents heavy scans over large search scopes)
      if (!optimizedJobs?.length || !canCreateItems || isSearching) return;
      
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
  }, [optimizedJobs, canCreateItems, isSearching, toast]);

  // Filter jobs by selected job type and statuses with database-level optimization
  const jobs = (optimizedJobs || []).filter((job: any) => {
    const matchesType = isSearching
      ? true // search overrides type filter
      : (selectedJobTypes.length === 0 ||
        selectedJobTypes.map(t => t.toLowerCase()).includes(String(job.job_type || '').toLowerCase()));
    const matchesStatus = selectedJobStatuses.length === 0 || selectedJobStatuses.includes(job.status);
    const q = debouncedQuery.trim().toLowerCase();
    const matchesSearch =
      q.length === 0 ||
      [job.title, job.client, job.location?.name, job.location?.formatted_address]
        .filter(Boolean)
        .some((s: string) => s.toLowerCase().includes(q));
    return matchesType && matchesStatus && matchesSearch;
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

  if (loading) {
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

  const toggleJobType = (type: string) => {
    setSelectedJobTypes(prev => (
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    ));
  };

  return (
    <div className="container mx-auto px-4 space-y-6">
      <Card>
        <ProjectManagementHeader
          isMobile={isMobile}
          allJobTypes={allJobTypes}
          selectedJobTypes={selectedJobTypes}
          onTypeToggle={toggleJobType}
          allJobStatuses={allJobStatuses}
          selectedJobStatuses={selectedJobStatuses}
          onStatusSelection={handleJobStatusSelection}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          jobsLoading={jobsLoading}
          canCreateItems={canCreateItems}
          onAutoCompleteAll={handleAutoCompleteAll}
          isAutoCompleting={isAutoCompleting}
        />
        <ProjectManagementContent
          currentDate={currentDate}
          onPreviousMonth={() => setCurrentDate(prev => addMonths(prev, -1))}
          onNextMonth={() => setCurrentDate(prev => addMonths(prev, 1))}
          selectedDepartment={selectedDepartment}
          onDepartmentChange={(value) => setSelectedDepartment(value as Department)}
          jobs={jobs}
          jobsLoading={jobsLoading}
          highlightToday={highlightToday}
        />
      </Card>
    </div>
  );
};

export default ProjectManagement;
