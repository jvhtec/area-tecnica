import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { JobAssignments } from "./JobAssignments";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { Loader2 } from "lucide-react";

interface JobAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  department: Department;
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  department: Department;
}

export const JobAssignmentDialog = ({ open, onOpenChange, jobId, department }: JobAssignmentDialogProps) => {
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const queryClient = useQueryClient();

  // Reset selections when department changes
  useEffect(() => {
    setSelectedTechnician("");
    setSelectedRole("");
  }, [department]);

  // Set up tab visibility tracking to refresh data when tab becomes visible
  useTabVisibility(['technicians']);

  const { data: technicians, isLoading: isLoadingTechnicians } = useQuery({
    queryKey: ["technicians", department],
    queryFn: async () => {
      console.log("Fetching technicians for department:", department);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, role, department")
        .eq("department", department)
        .in("role", ["technician", "house_tech"]); // Modified to include both technician and house_tech roles

      if (error) {
        console.error("Error fetching technicians:", error);
        throw error;
      }

      console.log("Fetched technicians:", data);
      return data as Technician[];
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

  // Validate assignment before submitting
  const validateAssignment = (techId: string, role: string, techs: Technician[]) => {
    const technician = techs.find(t => t.id === techId);
    if (!technician) {
      throw new Error("Selected technician not found");
    }

    if (technician.department !== department) {
      throw new Error(`Technician must belong to the ${department} department`);
    }

    const validRoles = getRoleOptions(department);
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role selected for ${department} department`);
    }

    return true;
  };

  const handleAssign = async () => {
    if (!selectedTechnician || !selectedRole) {
      toast.error("Please select both a technician and a role");
      return;
    }

    try {
      console.log("Assigning technician:", selectedTechnician, "with role:", selectedRole);
      
      // Validate assignment
      if (!technicians) {
        throw new Error("Technician data not available");
      }
      
      validateAssignment(selectedTechnician, selectedRole, technicians);

      // Check for existing assignment with same role
      const { data: existingAssignments } = await supabase
        .from("job_assignments")
        .select("*")
        .eq("job_id", jobId)
        .eq(`${department}_role`, selectedRole);

      if (existingAssignments?.length) {
        throw new Error(`A technician is already assigned as ${selectedRole}`);
      }

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
      toast.error(error.message || "Failed to assign technician");
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
          <DialogTitle>Assign {department.charAt(0).toUpperCase() + department.slice(1)} Technician</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Technician</label>
            {isLoadingTechnicians ? (
              <div className="flex items-center justify-center p-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${department} technician`} />
                </SelectTrigger>
                <SelectContent>
                  {technicians?.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.first_name} {tech.last_name} {tech.role === 'house_tech' ? '(House Tech)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${department} role`} />
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
            <Button 
              onClick={handleAssign}
              disabled={isLoadingTechnicians || !selectedTechnician || !selectedRole}
            >
              Assign
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
