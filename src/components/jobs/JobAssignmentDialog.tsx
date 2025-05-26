
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
    queryKey: ["available-technicians", department, jobId],
    queryFn: async () => {
      console.log("🔍 JobAssignmentDialog: Starting technician fetch for department:", department);
      
      if (!department) {
        console.error("❌ JobAssignmentDialog: No department provided");
        throw new Error("Department is required");
      }

      try {
        console.log("📡 JobAssignmentDialog: Executing Supabase query...");
        
        // Get ALL technicians from the specified department
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email, department, role")
          .eq("department", department);

        console.log("📊 JobAssignmentDialog: Raw Supabase response:", {
          data,
          error,
          dataLength: data?.length,
          department: department
        });

        if (error) {
          console.error("❌ JobAssignmentDialog: Supabase error:", error);
          throw error;
        }

        const techniciansData = (data || []) as Technician[];
        
        console.log("🔍 JobAssignmentDialog: Processed technicians data:", {
          totalCount: techniciansData.length,
          roles: techniciansData.map(t => ({ name: `${t.first_name} ${t.last_name}`, role: t.role })),
          roleCounts: techniciansData.reduce((acc, t) => {
            acc[t.role] = (acc[t.role] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });

        // Log each technician for debugging
        techniciansData.forEach((tech, index) => {
          console.log(`👤 Technician ${index + 1}:`, {
            id: tech.id,
            name: `${tech.first_name} ${tech.last_name}`,
            role: tech.role,
            department: tech.department,
            email: tech.email
          });
        });

        console.log(`✅ JobAssignmentDialog: Successfully fetched ${techniciansData.length} technicians from ${department} department`);
        
        return techniciansData;
      } catch (error) {
        console.error("💥 JobAssignmentDialog: Query function error:", error);
        throw error;
      }
    },
    enabled: open && !!department,
    staleTime: 0, // Always fetch fresh data for debugging
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Debug the technicians data whenever it changes
  useEffect(() => {
    if (technicians) {
      console.log("🔄 JobAssignmentDialog: Technicians data updated:", {
        count: technicians.length,
        technicians: technicians.map(t => ({
          id: t.id,
          name: `${t.first_name} ${t.last_name}`,
          role: t.role
        }))
      });
    }
  }, [technicians]);

  // Manual refresh function
  const handleManualRefresh = async () => {
    console.log("🔄 JobAssignmentDialog: Manual refresh triggered");
    try {
      // Clear all related cache
      await queryClient.invalidateQueries({ queryKey: ["available-technicians"] });
      await queryClient.removeQueries({ queryKey: ["available-technicians"] });
      
      // Force refetch
      await refetchTechnicians();
      toast.success("Technicians list refreshed");
      console.log("✅ JobAssignmentDialog: Manual refresh completed successfully");
    } catch (error) {
      console.error("❌ JobAssignmentDialog: Manual refresh failed:", error);
      toast.error("Failed to refresh technicians list");
    }
  };

  const handleDialogChange = async (isOpen: boolean) => {
    console.log("🚪 JobAssignmentDialog: Dialog state changing to:", isOpen);
    
    if (!isOpen) {
      // Reset form and refresh jobs data when dialog closes
      setSelectedTechnician("");
      setSelectedRole("");
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } else {
      // Force refresh when dialog opens
      console.log("🔄 JobAssignmentDialog: Dialog opened, forcing cache clear and refresh");
      await queryClient.invalidateQueries({ queryKey: ["available-technicians"] });
      await queryClient.removeQueries({ queryKey: ["available-technicians"] });
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
    if (!technicians) {
      console.log("⚠️ JobAssignmentDialog: No technicians data available for sorting");
      return [];
    }
    
    console.log("🔄 JobAssignmentDialog: Sorting technicians:", {
      inputCount: technicians.length,
      inputTechnicians: technicians.map(t => ({ name: `${t.first_name} ${t.last_name}`, role: t.role }))
    });
    
    const sorted = [...technicians].sort((a, b) => {
      // Sort house_tech before technician
      if (a.role === 'house_tech' && b.role !== 'house_tech') return -1;
      if (a.role !== 'house_tech' && b.role === 'house_tech') return 1;
      
      // Then sort by name
      return (a.first_name + a.last_name).localeCompare(b.first_name + b.last_name);
    });

    console.log("✅ JobAssignmentDialog: Technicians sorted:", {
      outputCount: sorted.length,
      outputTechnicians: sorted.map(t => ({ name: `${t.first_name} ${t.last_name}`, role: t.role }))
    });

    return sorted;
  };

  // Format technician display name
  const formatTechnicianName = (technician: Technician) => {
    const isHouseTech = technician.role === 'house_tech';
    const displayName = `${technician.first_name} ${technician.last_name}${isHouseTech ? ' (House Tech)' : ''}`;
    console.log("🏷️ JobAssignmentDialog: Formatting technician name:", {
      technician: technician,
      displayName: displayName
    });
    return displayName;
  };

  // Enhanced error display
  const renderTechnicianSelector = () => {
    console.log("🎨 JobAssignmentDialog: Rendering technician selector:", {
      isLoading: isLoadingTechnicians,
      hasError: !!techniciansError,
      technicianCount: technicians?.length || 0
    });

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
      console.error("❌ JobAssignmentDialog: Rendering error state:", techniciansError);
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
      console.warn("⚠️ JobAssignmentDialog: No technicians found, rendering empty state");
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

    const sortedTechnicians = getSortedTechnicians();
    console.log("🎛️ JobAssignmentDialog: Rendering select with technicians:", {
      count: sortedTechnicians.length,
      technicians: sortedTechnicians.map(t => ({ id: t.id, name: `${t.first_name} ${t.last_name}`, role: t.role }))
    });

    return (
      <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${department} technician (${sortedTechnicians.length} available)`} />
        </SelectTrigger>
        <SelectContent>
          {sortedTechnicians.map((tech, index) => {
            console.log(`🎯 JobAssignmentDialog: Rendering option ${index + 1}:`, {
              id: tech.id,
              name: `${tech.first_name} ${tech.last_name}`,
              role: tech.role
            });
            return (
              <SelectItem key={tech.id} value={tech.id}>
                {formatTechnicianName(tech)}
              </SelectItem>
            );
          })}
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
            
            {/* Debug information display */}
            {technicians && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                Debug: Found {technicians.length} {department} technicians
                {technicians.length > 0 && (
                  <div className="mt-1">
                    Roles: {Object.entries(
                      technicians.reduce((acc, t) => {
                        acc[t.role] = (acc[t.role] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([role, count]) => `${role}: ${count}`).join(', ')}
                  </div>
                )}
              </div>
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
