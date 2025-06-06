
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Department } from "@/types/department";
import { JobAssignments } from "./JobAssignments";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useAvailableTechnicians } from "@/hooks/useAvailableTechnicians";

interface JobAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  department: Department;
}

interface JobData {
  id: string;
  start_time: string;
  end_time: string;
  title: string;
}

export const JobAssignmentDialog = ({ open, onOpenChange, jobId, department }: JobAssignmentDialogProps) => {
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [jobData, setJobData] = useState<JobData | null>(null);
  const queryClient = useQueryClient();

  // Reset selections when department changes
  useEffect(() => {
    setSelectedTechnician("");
    setSelectedRole("");
  }, [department]);

  // Fetch job data to get start and end times
  useEffect(() => {
    const fetchJobData = async () => {
      if (!jobId) return;

      try {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, start_time, end_time, title")
          .eq("id", jobId)
          .single();

        if (error) {
          throw error;
        }

        setJobData(data);
      } catch (error) {
        console.error("Error fetching job data:", error);
      }
    };

    if (open && jobId) {
      fetchJobData();
    }
  }, [open, jobId]);

  // Use the new available technicians hook
  const {
    technicians,
    isLoading: isLoadingTechnicians,
    isError: techniciansError,
    isRefreshing,
    refetch: refetchTechnicians
  } = useAvailableTechnicians({
    department,
    jobId,
    jobStartTime: jobData?.start_time || "",
    jobEndTime: jobData?.end_time || "",
    enabled: open && !!jobData
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
  const validateAssignment = (techId: string, role: string) => {
    const technician = technicians.find(t => t.id === techId);
    if (!technician) {
      throw new Error("Selected technician not found or not available");
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
      // Validate assignment
      validateAssignment(selectedTechnician, selectedRole);

      const roleField = `${department}_role` as const;
      const { error } = await supabase
        .from("job_assignments")
        .insert({
          job_id: jobId,
          technician_id: selectedTechnician,
          [roleField]: selectedRole,
        });

      if (error) {
        throw error;
      }

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

  // Function to sort technicians - house techs first
  const getSortedTechnicians = () => {
    if (!technicians) {
      return [];
    }
    
    const sorted = [...technicians].sort((a, b) => {
      // Sort house_tech before technician
      if (a.role === 'house_tech' && b.role !== 'house_tech') return -1;
      if (a.role !== 'house_tech' && b.role === 'house_tech') return 1;
      
      // Then sort by name
      return (a.first_name + a.last_name).localeCompare(b.first_name + b.last_name);
    });

    return sorted;
  };

  // Format technician display name
  const formatTechnicianName = (technician: any) => {
    const isHouseTech = technician.role === 'house_tech';
    const displayName = `${technician.first_name} ${technician.last_name}${isHouseTech ? ' (House Tech)' : ''}`;
    return displayName;
  };

  // Enhanced error display
  const renderTechnicianSelector = () => {
    if (isLoadingTechnicians) {
      return (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">
            Loading available {department} technicians...
          </span>
        </div>
      );
    }

    if (techniciansError) {
      return (
        <div className="flex flex-col items-center p-4 space-y-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <span className="text-sm text-destructive text-center">
            Failed to load available technicians
          </span>
          <Button variant="outline" size="sm" onClick={refetchTechnicians}>
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
            No available {department} technicians found.
            <br />
            <span className="text-xs">
              (Technicians already assigned to this job or with conflicting dates are hidden)
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={refetchTechnicians}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      );
    }

    const sortedTechnicians = getSortedTechnicians();

    return (
      <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
        <SelectTrigger>
          <SelectValue placeholder={`Select available ${department} technician (${sortedTechnicians.length} available)`} />
        </SelectTrigger>
        <SelectContent>
          {sortedTechnicians.map((tech) => (
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
            {jobData && (
              <span className="text-sm font-normal text-muted-foreground">
                {jobData.title}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={refetchTechnicians}
              disabled={isLoadingTechnicians || isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingTechnicians || isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Available Technician</label>
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
