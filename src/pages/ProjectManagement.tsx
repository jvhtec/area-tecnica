import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, FileText, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import { MonthNavigation } from "@/components/project-management/MonthNavigation";
import { DepartmentTabs } from "@/components/project-management/DepartmentTabs";
import { useJobManagement } from "@/hooks/useJobManagement";
import { useTabVisibility } from "@/hooks/useTabVisibility";

const ProjectManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState<Department>("sound");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [selectedJobType, setSelectedJobType] = useState("All");
  const [allJobTypes, setAllJobTypes] = useState<string[]>([]);

  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  // Use custom hook to keep the "jobs" tab active/visible.
  useTabVisibility(["jobs"]);

  // Retrieve jobs using the custom hook. The hook already applies department and date filters.
  const { jobs: unfilteredJobs = [], jobsLoading, handleDeleteDocument } = useJobManagement(
    selectedDepartment,
    startDate,
    endDate,
    true
  );

  // Filter jobs by selected job type using a case-insensitive comparison.
  const jobs = (unfilteredJobs || []).filter((job: any) => {
    if (selectedJobType === "All") return true;
    return job.job_type?.toLowerCase() === selectedJobType.toLowerCase();
  });

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
        if (!profile || !["admin", "logistics", "management"].includes(profile.role)) {
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

  // Fetch all distinct job types (ignoring current filters) for the dropdown.
  useEffect(() => {
    const fetchJobTypes = async () => {
      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("job_type");
        if (error) {
          console.error("Error fetching job types:", error);
          return;
        }
        const types = Array.from(
          new Set((data || [])
            .map((job: any) => job.job_type)
            .filter(Boolean))
        );
        setAllJobTypes(types);
      } catch (error) {
        console.error("Error in fetchJobTypes:", error);
      }
    };

    fetchJobTypes();
  }, []);

  if (loading || jobsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Project Management</CardTitle>
          <div className="flex gap-2">
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
            onDeleteDocument={handleDeleteDocument}
            userRole={userRole}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectManagement;
