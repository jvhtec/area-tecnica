
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import { ShiftWithAssignments, Technician } from "@/types/festival-scheduling";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

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
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTech, setIsAddingTech] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAssignedTechnicians = async () => {
      try {
        console.log("Fetching technicians assigned to job:", jobId);
        setIsLoading(true);

        // Fetch all technicians that are already assigned to this job
        const { data: jobAssignments, error: assignmentsError } = await supabase
          .from("job_assignments")
          .select("technician_id, profiles(id, first_name, last_name, email, department, role)")
          .eq("job_id", jobId);

        if (assignmentsError) {
          console.error("Error fetching job assignments:", assignmentsError);
          throw assignmentsError;
        }

        console.log("Job assignments fetched:", jobAssignments);

        if (jobAssignments && jobAssignments.length > 0) {
          // Extract the technician profiles from the job assignments
          const assignedTechnicians = jobAssignments
            .filter(assignment => assignment.profiles)
            .map(assignment => assignment.profiles)
            .filter(profile => profile.role === 'technician' || profile.role === 'house_tech');

          console.log("Filtered technicians for shift assignment:", assignedTechnicians);
          setTechnicians(assignedTechnicians);
        } else {
          console.log("No technicians assigned to this job");
          setTechnicians([]);
        }
      } catch (error: any) {
        console.error("Error fetching assigned technicians:", error);
        toast({
          title: "Error",
          description: "Could not load technicians assigned to this job",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (open && jobId) {
      fetchAssignedTechnicians();
    }
  }, [open, jobId, toast]);

  const handleAddAssignment = async () => {
    if (!selectedTechnician || !selectedRole) {
      toast({
        title: "Missing Information",
        description: "Please select a technician and a role",
        variant: "destructive",
      });
      return;
    }

    setIsAddingTech(true);
    try {
      console.log("Adding assignment with shift_id:", shift.id);
      console.log("Adding assignment with technician_id:", selectedTechnician);
      console.log("Adding assignment with role:", selectedRole);
      
      // Check if this technician is already assigned to this shift
      const existingAssignment = shift.assignments.find(
        (a) => a.technician_id === selectedTechnician
      );

      if (existingAssignment) {
        toast({
          title: "Already Assigned",
          description: "This technician is already assigned to this shift",
          variant: "destructive",
        });
        setIsAddingTech(false);
        return;
      }

      const { data, error } = await supabase.from("festival_shift_assignments").insert({
        shift_id: shift.id,
        technician_id: selectedTechnician,
        role: selectedRole,
      }).select();

      if (error) {
        console.error("Error creating assignment:", error);
        throw error;
      }

      setSelectedTechnician("");
      setSelectedRole("");
      onAssignmentsUpdated();

      toast({
        title: "Success",
        description: "Technician added to shift",
      });
    } catch (error: any) {
      console.error("Error adding assignment:", error);
      toast({
        title: "Error",
        description: `Could not add technician to shift: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsAddingTech(false);
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
        description: "Technician removed from shift",
      });
    } catch (error: any) {
      console.error("Error removing assignment:", error);
      toast({
        title: "Error",
        description: "Could not remove technician from shift",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Manage Shift Assignments</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="font-medium">Shift Details</h3>
            <div className="flex flex-col gap-1 text-sm">
              <p><span className="font-medium">Name:</span> {shift.name}</p>
              <p><span className="font-medium">Time:</span> {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}</p>
              {shift.department && (
                <p><span className="font-medium">Department:</span> {shift.department}</p>
              )}
              {shift.stage && (
                <p><span className="font-medium">Stage:</span> {shift.stage}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Current Assignments</h3>
            {shift.assignments.length > 0 ? (
              <div className="space-y-2">
                {shift.assignments.map((assignment) => (
                  <div key={assignment.id} className="flex justify-between items-center p-2 bg-accent/10 rounded-md">
                    <div className="flex items-center">
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
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-muted-foreground text-sm">
                No technicians assigned
              </div>
            )}
          </div>

          <div className="space-y-3 border-t pt-3">
            <h3 className="font-medium">Add Technician</h3>
            {technicians.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Technician</Label>
                  <Select 
                    onValueChange={setSelectedTechnician} 
                    value={selectedTechnician}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select technician" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.first_name} {tech.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select 
                    onValueChange={setSelectedRole} 
                    value={selectedRole}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FOH Engineer">FOH Engineer</SelectItem>
                      <SelectItem value="Monitor Engineer">Monitor Engineer</SelectItem>
                      <SelectItem value="PA Tech">PA Tech</SelectItem>
                      <SelectItem value="RF Tech">RF Tech</SelectItem>
                      <SelectItem value="Lighting Tech">Lighting Tech</SelectItem>
                      <SelectItem value="Lighting Designer">Lighting Designer</SelectItem>
                      <SelectItem value="Video Tech">Video Tech</SelectItem>
                      <SelectItem value="Camera Operator">Camera Operator</SelectItem>
                      <SelectItem value="Rigger">Rigger</SelectItem>
                      <SelectItem value="Stage Manager">Stage Manager</SelectItem>
                      <SelectItem value="Backline Tech">Backline Tech</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-muted-foreground">
                No technicians assigned to this job. Please assign technicians to the job first.
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button 
            onClick={handleAddAssignment}
            disabled={!selectedTechnician || !selectedRole || isAddingTech || technicians.length === 0}
            className="flex items-center gap-1"
          >
            <UserPlus className="h-4 w-4" />
            {isAddingTech ? "Adding..." : "Add Technician"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
