import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { JobAssignments } from "./JobAssignments";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useState } from "react";
import { toast } from "sonner";
import { useTabVisibility } from "@/hooks/useTabVisibility";

interface JobAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  department: Department;
}

export const JobAssignmentDialog = ({ open, onOpenChange, jobId, department }: JobAssignmentDialogProps) => {
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const queryClient = useQueryClient();

  // Set up tab visibility tracking to refresh data when tab becomes visible
  useTabVisibility(['technicians']);

  const { data: technicians, isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ["technicians", department],
    queryFn: async () => {
      console.log("Fetching technicians for department:", department);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("department", department);

      if (error) {
        console.error("Error fetching technicians:", error);
        throw error;
      }

      console.log("Fetched technicians:", data);
      return data;
    },
    staleTime: 1000 * 60 * 5, // Consider data fresh for 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const handleDialogChange = async (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form and refresh jobs data when dialog closes
      setSelectedTechnician("");
      setSelectedRole("");
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    }
    onOpenChange(isOpen);
  };

  const handleAssign = async () => {
    if (!selectedTechnician || !selectedRole) {
      toast.error("Please select both a technician and a role");
      return;
    }

    try {
      console.log("Assigning technician:", selectedTechnician, "with role:", selectedRole);
      
      const roleField = `${department}_role` as const;
      const { error } = await supabase
        .from("job_assignments")
        .insert({
          job_id: jobId,
          technician_id: selectedTechnician,
          [roleField]: selectedRole,
        });

      if (error) {
        console.error("Error assigning technician:", error);
        throw error;
      }

      console.log("Technician assigned successfully");
      toast.success("Technician assigned successfully");
      
      // Reset form and close dialog
      setSelectedTechnician("");
      setSelectedRole("");
      handleDialogChange(false);
      
    } catch (error: any) {
      console.error("Failed to assign technician:", error);
      toast.error("Failed to assign technician: " + error.message);
    }
  };

  const getRoleOptions = (department: Department) => {
    switch (department) {
      case "sound":
        return ["FOH Engineer", "Monitor Engineer", "PA Tech", "RF Tech"];
      case "lights":
        return ["Lighting Designer", "Lighting Tech", "Follow Spot"];
      case "video":
        return ["Video Director", "Camera Operator", "Video Tech"];
      default:
        return [];
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Technician</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Technician</label>
            <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
              <SelectTrigger>
                <SelectValue placeholder="Select technician" />
              </SelectTrigger>
              <SelectContent>
                {technicians?.map((tech) => (
                  <SelectItem key={tech.id} value={tech.id}>
                    {tech.first_name} {tech.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {getRoleOptions(department).map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <JobAssignments jobId={jobId} department={department} />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign}>
              Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
