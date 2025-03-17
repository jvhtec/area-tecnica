import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FestivalShift, ShiftWithAssignments } from "@/types/festival-scheduling";

interface ManageAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftWithAssignments;
  onAssignmentsUpdated: () => void;
  isViewOnly?: boolean; // Add isViewOnly prop
}

export const ManageAssignmentsDialog = ({ 
  open, 
  onOpenChange, 
  shift, 
  onAssignmentsUpdated,
  isViewOnly = false // Default to false
}: ManageAssignmentsDialogProps) => {
  const [technicianId, setTechnicianId] = useState("");
  const [role, setRole] = useState("technician");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: technicians, isLoading: isLoadingTechnicians, error: techniciansError } = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, department, role")
        .eq("department", "sound")
        .eq("role", "technician");

      if (error) {
        console.error("Error fetching technicians:", error);
        throw error;
      }
      return data;
    },
  });

  const addAssignmentMutation = useMutation(
    async () => {
      if (!technicianId || !shift?.id) {
        throw new Error("Technician and shift ID are required");
      }

      const { data, error } = await supabase
        .from("festival_shift_assignments")
        .insert([{ shift_id: shift.id, technician_id: technicianId, role: role }]);

      if (error) {
        console.error("Error adding assignment:", error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["festivalShifts"]);
        onAssignmentsUpdated();
        toast({
          title: "Success",
          description: "Technician assigned successfully",
        });
      },
      onError: (error: any) => {
        console.error("Error adding assignment:", error);
        toast({
          title: "Error",
          description: "Could not assign technician",
          variant: "destructive",
        });
      },
    }
  );

  const removeAssignmentMutation = useMutation(
    async (assignmentId: string) => {
      const { data, error } = await supabase
        .from("festival_shift_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) {
        console.error("Error removing assignment:", error);
        throw error;
      }
      return data;
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["festivalShifts"]);
        onAssignmentsUpdated();
        toast({
          title: "Success",
          description: "Technician unassigned successfully",
        });
      },
      onError: (error: any) => {
        console.error("Error removing assignment:", error);
        toast({
          title: "Error",
          description: "Could not unassign technician",
          variant: "destructive",
        });
      },
    }
  );

  const handleAddAssignment = async () => {
    try {
      await addAssignmentMutation.mutateAsync();
    } catch (error: any) {
      console.error("Error adding assignment:", error);
      toast({
        title: "Error",
        description: "Could not assign technician",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await removeAssignmentMutation.mutateAsync(assignmentId);
    } catch (error: any) {
      console.error("Error removing assignment:", error);
      toast({
        title: "Error",
        description: "Could not unassign technician",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isViewOnly ? "View Staff for" : "Manage Staff for"} {shift.name}
          </DialogTitle>
          <DialogDescription>
            {isViewOnly 
              ? "View staff assigned to this shift" 
              : "Add or remove staff from this shift"}
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingTechnicians ? (
          <div className="flex justify-center p-4">Loading technicians...</div>
        ) : techniciansError ? (
          <div className="text-red-500">Error loading technicians.</div>
        ) : (
          !isViewOnly && ( // Only show add staff UI if not view-only
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="technician">Technician</Label>
                <Select onValueChange={setTechnicianId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians?.map((technician) => (
                      <SelectItem key={technician.id} value={technician.id}>
                        {technician.first_name} {technician.last_name} ({technician.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select onValueChange={setRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="stagehand">Stagehand</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddAssignment} disabled={addAssignmentMutation.isLoading}>
                {addAssignmentMutation.isLoading ? "Assigning..." : "Assign Technician"}
              </Button>
            </div>
          )
        )}
        
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Assigned Staff</h3>
          {shift.assignments.map(assignment => (
            <div key={assignment.id} className="flex items-center justify-between p-2 bg-accent/20 rounded-md">
              <div>
                {assignment.profiles?.first_name} {assignment.profiles?.last_name} - {assignment.role}
              </div>
              {!isViewOnly && ( // Only show remove buttons if not view-only
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleRemoveAssignment(assignment.id)}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
