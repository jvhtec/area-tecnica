
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { Department } from "@/types/department";
import { User, X, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { SubscriptionIndicator } from "../ui/subscription-indicator";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";

interface JobAssignmentsProps {
  jobId: string;
  department?: Department;
  userRole?: string | null;
}

export const JobAssignments = ({ jobId, department, userRole }: JobAssignmentsProps) => {
  const queryClient = useQueryClient();
  const { assignments, isLoading, isRefreshing, refetch } = useJobAssignmentsRealtime(jobId);

  const handleDelete = async (technicianId: string) => {
    if (userRole === 'logistics') return;
    
    try {
      const { error } = await supabase
        .from("job_assignments")
        .delete()
        .eq("job_id", jobId)
        .eq("technician_id", technicianId);

      if (error) throw error;

      // Refresh both assignments and jobs data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["job-assignments", jobId] }),
        queryClient.invalidateQueries({ queryKey: ["jobs"] })
      ]);

      toast.success("Assignment deleted successfully");
    } catch (error: any) {
      console.error("Error deleting assignment:", error);
      toast.error("Failed to delete assignment");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="animate-pulse text-sm text-muted-foreground">Loading assignments...</div>
      </div>
    );
  }

  if (!assignments?.length) return null;

  // Filter assignments based on department if specified
  const filteredAssignments = department
    ? assignments.filter(assignment => {
        return assignment.profiles.department === department;
      })
    : assignments;

  if (!filteredAssignments.length) return null;

  const getRoleForDepartment = (assignment: Assignment) => {
    switch (department) {
      case "sound":
        return assignment.sound_role;
      case "lights":
        return assignment.lights_role;
      case "video":
        return assignment.video_role;
      default:
        return assignment.sound_role || assignment.lights_role || assignment.video_role;
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          {filteredAssignments.length} assignment{filteredAssignments.length !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1">
          <SubscriptionIndicator tables={["job_assignments"]} variant="compact" showRefreshButton onRefresh={refetch} />
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={isRefreshing}
            onClick={() => refetch()}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      {filteredAssignments.map((assignment) => {
        const role = getRoleForDepartment(assignment);
        if (!role) return null;
        
        return (
          <div
            key={`${assignment.job_id}-${assignment.technician_id}`}
            className="flex items-center justify-between gap-2 text-sm text-muted-foreground bg-secondary/50 p-2 rounded-md"
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="font-medium">
                {assignment.profiles.first_name} {assignment.profiles.last_name}
              </span>
              <span className="text-xs">({role})</span>
            </div>
            {userRole !== 'logistics' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleDelete(assignment.technician_id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
};
