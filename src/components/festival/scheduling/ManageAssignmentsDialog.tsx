
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ShiftWithAssignments, Technician } from "@/types/festival-scheduling";

interface ManageAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftWithAssignments;
  jobId: string;
  onAssignmentsUpdated: () => void;
}

export const ManageAssignmentsDialog = ({
  open,
  onOpenChange,
  shift,
  jobId,
  onAssignmentsUpdated,
}: ManageAssignmentsDialogProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchAvailableTechnicians();
    }
  }, [open, shift.department]);

  const fetchAvailableTechnicians = async () => {
    setIsLoading(true);
    try {
      // First get all technicians assigned to this job
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("job_assignments")
        .select(`
          technician_id,
          profiles (
            id,
            first_name,
            last_name,
            email,
            department,
            role
          )
        `)
        .eq("job_id", jobId);

      if (assignmentsError) throw assignmentsError;

      // Filter technicians if a department is specified for the shift
      let techsData = assignmentsData;
      if (shift.department) {
        techsData = assignmentsData.filter(
          (assignment) => assignment.profiles.department === shift.department
        );
      }

      // Format technicians data
      const formattedTechnicians = techsData.map((assignment) => ({
        id: assignment.technician_id,
        first_name: assignment.profiles.first_name,
        last_name: assignment.profiles.last_name,
        email: assignment.profiles.email,
        department: assignment.profiles.department,
        role: assignment.profiles.role,
      }));

      setTechnicians(formattedTechnicians);
    } catch (error: any) {
      console.error("Error fetching technicians:", error);
      toast({
        title: "Error",
        description: "Could not load technicians",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignTechnician = async () => {
    if (!selectedTechnician || !selectedRole) {
      toast({
        title: "Error",
        description: "Please select both a technician and a role",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check if technician is already assigned to this shift
      const { data: existingAssignments, error: checkError } = await supabase
        .from("festival_shift_assignments")
        .select("*")
        .eq("shift_id", shift.id)
        .eq("technician_id", selectedTechnician);

      if (checkError) throw checkError;

      if (existingAssignments && existingAssignments.length > 0) {
        toast({
          title: "Error",
          description: "This technician is already assigned to this shift",
          variant: "destructive",
        });
        return;
      }

      // Add assignment
      const { error } = await supabase.from("festival_shift_assignments").insert({
        shift_id: shift.id,
        technician_id: selectedTechnician,
        role: selectedRole,
      });

      if (error) throw error;

      // Reset selections
      setSelectedTechnician("");
      setSelectedRole("");
      
      // Refresh assignments
      onAssignmentsUpdated();
      
      toast({
        title: "Success",
        description: "Technician assigned successfully",
      });
    } catch (error: any) {
      console.error("Error assigning technician:", error);
      toast({
        title: "Error",
        description: "Could not assign technician",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("festival_shift_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      onAssignmentsUpdated();
      toast({
        title: "Success",
        description: "Assignment removed successfully",
      });
    } catch (error: any) {
      console.error("Error removing assignment:", error);
      toast({
        title: "Error",
        description: "Could not remove assignment",
        variant: "destructive",
      });
    }
  };

  const getRoleOptions = (department?: string) => {
    if (!department) {
      return [
        "FOH Engineer", "Monitor Engineer", "PA Tech", "RF Tech",
        "Lighting Designer", "Lighting Tech", "Follow Spot",
        "Video Director", "Camera Operator", "Video Tech",
        "Load In", "Load Out", "Runner"
      ];
    }

    switch (department) {
      case "sound":
        return ["FOH Engineer", "Monitor Engineer", "PA Tech", "RF Tech"];
      case "lights":
        return ["Lighting Designer", "Lighting Tech", "Follow Spot"];
      case "video":
        return ["Video Director", "Camera Operator", "Video Tech"];
      case "logistics":
        return ["Load In", "Load Out", "Runner"];
      default:
        return [];
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Technicians for {shift.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Current Assignments</h3>
            {shift.assignments.length > 0 ? (
              <div className="space-y-2">
                {shift.assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex justify-between items-center p-2 bg-accent/10 rounded-md"
                  >
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>
                        {assignment.profiles?.first_name} {assignment.profiles?.last_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{assignment.role}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No technicians assigned yet
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-medium">Assign New Technician</h3>
            
            <div className="space-y-2">
              <Label htmlFor="technician">Select Technician</Label>
              {isLoading ? (
                <div className="flex items-center justify-center p-2">
                  <span className="text-sm text-muted-foreground">Loading technicians...</span>
                </div>
              ) : (
                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.length > 0 ? (
                      technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.first_name} {tech.last_name} ({tech.department})
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No technicians available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {getRoleOptions(shift.department).map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={handleAssignTechnician}
              disabled={!selectedTechnician || !selectedRole || isLoading}
            >
              Assign Technician
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
