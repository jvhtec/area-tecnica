
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
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";

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
    console.log("JobAssignmentDialog: Department changed to:", department);
    setSelectedTechnician("");
    setSelectedRole("");
  }, [department]);

  // Set up tab visibility tracking to refresh data when tab becomes visible
  useTabVisibility(['technicians']);

  const { data: technicians, isLoading: isLoadingTechnicians, error: techniciansError, refetch: refetchTechnicians } = useQuery({
    queryKey: ["available-technicians", department],
    queryFn: async () => {
      console.log("JobAssignmentDialog: Fetching ALL technicians for department:", department);
      
      if (!department) {
        console.error("JobAssignmentDialog: No department provided");
        throw new Error("Department is required");
      }

      try {
        // Get ALL technicians from the specified department (not just assigned ones)
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, department, role")
          .eq("department", department);

        if (error) {
          console.error("JobAssignmentDialog: Error fetching technicians:", error);
          throw error;
        }

        console.log(`JobAssignmentDialog: Found ${data?.length || 0} technicians in ${department} department`);
        console.log("JobAssignmentDialog: Technicians data:", data);

        return (data || []) as Technician[];
      } catch (error) {
        console.error("JobAssignmentDialog: Query function error:", error);
        throw error;
      }
    },
    enabled: open && !!department,
    staleTime: 1000 * 30, // Consider data fresh for 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Manual refresh function
  const handleManualRefresh = async () => {
    console.log("JobAssignmentDialog: Manual refresh triggered");
    try {
      await queryClient.invalidateQueries({ queryKey: ["available-technicians"] });
      await refetchTechnicians();
      toast.success("Technicians list refreshed");
    } catch (error) {
      console.error("JobAssignmentDialog: Manual refresh failed:", error);
      toast.error("Failed to refresh technicians list");
    }
  };

  const handleDialogChange = async (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form and refresh jobs data when dialog closes
      setSelectedTechnician("");
      setSelectedRole("");
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } else {
      // Force refresh when dialog opens
      console.log("JobAssignmentDialog: Dialog opened, forcing refresh");
      await queryClient.invalidateQueries({ queryKey: ["available-technicians"] });
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
      console.log("JobAssignmentDialog: Assigning technician:", selectedTechnician, "with role:", selectedRole);
      
      // Validate assignment
      if (!technicians) {
        throw new Error("Technician data not available");
      }
      
      validateAssignment(selectedTechnician, selectedRole, technicians);

      const roleField = `${department}_role` as const;
      const { error } = await supabase
        .from("job_assignments")
        .insert({
          job_id: jobId,
          technician_id: selectedTechnician,
          [roleField]: selectedRole,
        });

      if (error) {
        console.error("JobAssignmentDialog: Error assigning technician:", error);
        throw error;
      }

      console.log("JobAssignmentDialog: Technician assigned successfully");
      toast.success("Technician assigned successfully");
      
      // Reset form and close dialog
      setSelectedTechnician("");
      setSelectedRole("");
      handleDialogChange(false);
      
    } catch (error: any) {
      console.error("JobAssignmentDialog: Failed to assign technician:", error);
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

  // Function to sort technicians - house techs first
  const getSortedTechnicians = () => {
    if (!technicians) return [];
    
    return [...technicians].sort((a, b) => {
      // Sort house_tech before technician
      if (a.role === 'house_tech' && b.role !== 'house_tech') return -1;
      if (a.role !== 'house_tech' && b.role === 'house_tech') return 1;
      
      // Then sort by name
      return (a.first_name + a.last_name).localeCompare(b.first_name + b.last_name);
    });
  };

  // Format technician display name
  const formatTechnicianName = (technician: Technician) => {
    const isHouseTech = technician.role === 'house_tech';
    return `${technician.first_name} ${technician.last_name}${isHouseTech ? ' (House Tech)' : ''}`;
  };

  // Enhanced error display
  const renderTechnicianSelector = () => {
    if (isLoadingTechnicians) {
      return (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">
            Loading {department} technicians...
          </span>
        </div>
      );
    }

    if (techniciansError) {
      return (
        <div className="flex flex-col items-center p-4 space-y-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <span className="text-sm text-destructive text-center">
            Failed to load technicians: {techniciansError.message}
          </span>
          <Button variant="outline" size="sm" onClick={handleManualRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    if (!technicians || technicians.length === 0) {
      return (
        <div className="flex flex-col items-center p-4 space-y-2">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground text-center">
            No {department} technicians found in the system.
          </span>
          <Button variant="outline" size="sm" onClick={handleManualRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      );
    }

    return (
      <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${department} technician`} />
        </SelectTrigger>
        <SelectContent>
          {getSortedTechnicians().map((tech) => (
            <SelectItem key={tech.id} value={tech.id}>
              {formatTechnicianName(tech)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Assign {department.charAt(0).toUpperCase() + department.slice(1)} Technician
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isLoadingTechnicians}
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingTechnicians ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Technician</label>
            {renderTechnicianSelector()}
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
