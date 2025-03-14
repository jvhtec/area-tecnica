import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Assignment } from "@/types/assignment";
import { Department } from "@/types/department";
import { User, X } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "sonner";

interface JobAssignmentsProps {
  jobId: string;
  department?: Department;
  userRole?: string | null;
}

export const JobAssignments = ({ jobId, department, userRole }: JobAssignmentsProps) => {
  const queryClient = useQueryClient();

  const { data: assignments } = useQuery({
    queryKey: ["job-assignments", jobId],
    queryFn: async () => {
      console.log("Fetching assignments for job:", jobId);
      const { data, error } = await supabase
        .from("job_assignments")
        .select(`
          *,
          profiles (
            first_name,
            last_name,
            email,
            department
          )
        `)
        .eq("job_id", jobId);

      if (error) {
        console.error("Error fetching assignments:", error);
        throw error;
      }

      if (!data) return [];

      console.log("Assignments data:", data);
      return data as unknown as Assignment[];
    },
  });

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