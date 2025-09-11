
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, FileText, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { startOfMonth, endOfMonth, addMonths, isToday } from "date-fns";
import { MonthNavigation } from "@/components/project-management/MonthNavigation";
import { DepartmentTabs } from "@/components/project-management/DepartmentTabs";
import { useOptimizedJobs } from "@/hooks/useOptimizedJobs";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";

const ProjectManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("sound");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedJobType, setSelectedJobType] = useState("All");
  const [selectedJobStatus, setSelectedJobStatus] = useState("All");
  const [allJobTypes, setAllJobTypes] = useState<string[]>([]);
  const [allJobStatuses, setAllJobStatuses] = useState<string[]>([]);
  const [highlightToday, setHighlightToday] = useState(false);
  const { forceSubscribe } = useSubscriptionContext();

  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  // Use custom hook to keep the "jobs" tab active/visible.
  useTabVisibility(["jobs"]);
  
  // Force subscription to required tables
  useEffect(() => {
    forceSubscribe(['jobs', 'job_assignments', 'job_departments']);
  }, [forceSubscribe]);

  // Use optimized jobs hook with built-in filtering and caching
  const { data: optimizedJobs = [], isLoading: jobsLoading, error: jobsError } = useOptimizedJobs(
    selectedDepartment,
    startDate,
    endDate
  );

  // Filter jobs by selected job type and status with database-level optimization
  const jobs = (optimizedJobs || []).filter((job: any) => {
    const matchesType = selectedJobType === "All" || job.job_type?.toLowerCase() === selectedJobType.toLowerCase();
    const matchesStatus = selectedJobStatus === "All" || job.status === selectedJobStatus;
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
  const canCreateItems = ['admin', 'management', 'logistics'].includes(userRole || '');

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
              <div className="flex items-center gap-2">
                <select
                  value={selectedJobStatus}
                  onChange={(e) => setSelectedJobStatus(e.target.value)}
                  className="border border-gray-300 rounded-md py-1 px-2 text-sm"
                >
                  <option value="All">All Status</option>
                  {allJobStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status === "Tentativa" ? "Tentative" : 
                       status === "Confirmado" ? "Confirmed" :
                       status === "Completado" ? "Completed" :
                       status === "Cancelado" ? "Cancelled" : status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {canCreateItems && (
              <>
                <Button 
                  onClick={() => navigate("/hoja-de-ruta")} 
                  className="flex items-center gap-2"
                  variant="outline"
                >
                  <FileText className="h-4 w-4" />
                  Hoja de Ruta
                </Button>
                <Button 
                  onClick={() => navigate("/labor-po-form")} 
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Labor PO
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
