import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Job } from "@/types/job";
import { User } from "@/types/user";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useJobAssignmentsRealtime } from "@/hooks/useJobAssignmentsRealtime";
import { useFlexCrewAssignments } from "@/hooks/useFlexCrewAssignments";
import { ExternalLink } from "lucide-react";

interface JobAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssignmentChange: () => void;
  jobId: string;
  department?: string;
}

interface Assignment {
  technician_id: string;
  sound_role: string;
  lights_role: string;
}

export const JobAssignmentDialog = ({ isOpen, onClose, onAssignmentChange, jobId, department }: JobAssignmentDialogProps) => {
  const { toast } = useToast();
  const [availableTechnicians, setAvailableTechnicians] = useState<User[]>([]);
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [soundRole, setSoundRole] = useState<string>("none");
  const [lightsRole, setLightsRole] = useState<string>("none");
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { assignments, addAssignment, removeAssignment, isRemoving } = useJobAssignmentsRealtime(jobId);
  const { manageFlexCrewAssignment, useCrewCallData } = useFlexCrewAssignments();

  // Fetch crew call data for the current job and department
  const { data: crewCallData, isLoading: isLoadingCrewCall } = useCrewCallData(jobId, department || 'sound');

  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("first_name", { ascending: true });

        if (error) {
          console.error("Error fetching technicians:", error);
          toast({
            title: "Error",
            description: "Could not load technicians",
            variant: "destructive",
          });
          return;
        }

        setAvailableTechnicians(data as User[]);
      } catch (error) {
        console.error("Error fetching technicians:", error);
        toast({
          title: "Error",
          description: "Could not load technicians",
          variant: "destructive",
        });
      }
    };

    fetchTechnicians();
  }, [toast]);

  const handleAddTechnician = async () => {
    if (!selectedTechnician) {
      toast({
        title: "Warning",
        description: "Please select a technician",
      });
      return;
    }

    setIsAdding(true);

    try {
      await addAssignment(selectedTechnician, soundRole, lightsRole);

      toast({
        title: "Success",
        description: "Technician assigned successfully",
      });

      setSelectedTechnician(null);
      setSoundRole("none");
      setLightsRole("none");
      onAssignmentChange();
    } catch (error: any) {
      console.error("Error adding technician:", error);
      toast({
        title: "Error",
        description: "Could not assign technician",
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveAssignments = async () => {
    const assignmentsToProcess: Assignment[] = [];

    availableTechnicians.forEach((technician) => {
      const assignment = assignments.find(
        (a) => a.technician_id === technician.id
      );

      if (assignment) {
        assignmentsToProcess.push({
          technician_id: technician.id,
          sound_role: assignment.sound_role,
          lights_role: assignment.lights_role,
        });
      }
    });

    if (assignmentsToProcess.length === 0) {
      toast({
        title: "Info",
        description: "No assignments to save",
      });
      onClose();
      return;
    }

    try {
      setIsLoading(true);

      // Process assignments for Flex integration
      for (const assignment of assignmentsToProcess) {
        const technicianId = assignment.technician_id;
        
        // Add to Flex crew calls for sound and lights departments
        if (assignment.sound_role && assignment.sound_role !== 'none') {
          await manageFlexCrewAssignment(jobId, technicianId, 'sound', 'add');
        }
        
        if (assignment.lights_role && assignment.lights_role !== 'none') {
          await manageFlexCrewAssignment(jobId, technicianId, 'lights', 'add');
        }
      }

      toast({
        title: "Success",
        description: "Assignments saved successfully",
      });
      onClose();
      onAssignmentChange();
    } catch (error: any) {
      console.error("Error saving assignments:", error);
      toast({
        title: "Error",
        description: "Could not save assignments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewCrewCall = () => {
    if (crewCallData?.flex_element_id) {
      const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#contact-list/${crewCallData.flex_element_id}/detail`;
      window.open(flexUrl, '_blank');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Manage Job Assignments</span>
            {crewCallData?.flex_element_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewCrewCall}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                View Crew Call in Flex
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            Assign technicians to this job and specify their roles.
            {department && crewCallData?.flex_element_id && (
              <span className="block text-sm text-muted-foreground mt-1">
                Crew call available for {department} department.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="technician" className="text-right">
              Technician
            </Label>
            <Select
              onValueChange={setSelectedTechnician}
              defaultValue={selectedTechnician || ""}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a technician" />
              </SelectTrigger>
              <SelectContent>
                {availableTechnicians.map((technician) => (
                  <SelectItem key={technician.id} value={technician.id}>
                    {technician.first_name} {technician.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sound-role" className="text-right">
              Sound Role
            </Label>
            <Select onValueChange={setSoundRole} defaultValue={soundRole}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="engineer">Engineer</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lights-role" className="text-right">
              Lights Role
            </Label>
            <Select onValueChange={setLightsRole} defaultValue={lightsRole}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleAddTechnician}
            disabled={isAdding || !selectedTechnician}
          >
            {isAdding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              "Add Technician"
            )}
          </Button>
        </div>

        <div className="py-4">
          <h3 className="text-lg font-semibold mb-2">Current Assignments</h3>
          {assignments.length === 0 ? (
            <p className="text-muted-foreground">No technicians assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {assignments.map((assignment) => {
                const technician = availableTechnicians.find(
                  (t) => t.id === assignment.technician_id
                );
                return (
                  <div
                    key={assignment.technician_id}
                    className="flex items-center justify-between border rounded-md p-2"
                  >
                    <div>
                      {technician
                        ? `${technician.first_name} ${technician.last_name}`
                        : "Unknown Technician"}
                      <p className="text-sm text-muted-foreground">
                        Sound: {assignment.sound_role}, Lights:{" "}
                        {assignment.lights_role}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isRemoving[assignment.technician_id]}
                        >
                          {isRemoving[assignment.technician_id] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Removing...
                            </>
                          ) : (
                            "Remove"
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            remove the technician from this job.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeAssignment(assignment.technician_id)}
                          >
                            Continue
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="submit" onClick={handleSaveAssignments} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </>
            ) : (
              "Save Assignments"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
