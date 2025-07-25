
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
import { useAvailableTechnicians } from "@/hooks/useAvailableTechnicians";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
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

// Department-specific role options
const getDepartmentRoles = (department: string) => {
  switch (department) {
    case "sound":
      return ["FOH Engineer", "Monitor Engineer", "RF Technician", "PA Technician"];
    case "lights":
      return ["Lighting Designer", "Lighting Technician", "Follow Spot", "Rigger"];
    case "video":
      return ["Video Director", "Video Technician", "Camera Operator", "Playback Technician"];
    default:
      return ["FOH Engineer", "Monitor Engineer", "RF Technician", "PA Technician"];
  }
};

// Helper function to format technician name from assignment
const formatAssignmentTechnicianName = (assignment: any) => {
  if (assignment.profiles) {
    const firstName = assignment.profiles.first_name || '';
    const lastName = assignment.profiles.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Unnamed Technician';
  }
  return 'Unknown Technician';
};

// Helper function to format available technician name
const formatAvailableTechnicianName = (technician: { first_name: string; last_name: string; role: string }) => {
  const isHouseTech = technician.role === 'house_tech';
  return `${technician.first_name} ${technician.last_name}${isHouseTech ? ' (House Tech)' : ''}`;
};

export const JobAssignmentDialog = ({ isOpen, onClose, onAssignmentChange, jobId, department }: JobAssignmentDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [soundRole, setSoundRole] = useState<string>("none");
  const [lightsRole, setLightsRole] = useState<string>("none");
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { assignments, addAssignment, removeAssignment, isRemoving } = useJobAssignmentsRealtime(jobId);
  const { manageFlexCrewAssignment, useCrewCallData } = useFlexCrewAssignments();

  // Get current user's department or use the passed department
  const currentDepartment = department || user?.department || "sound";

  // Fetch job data to get start/end times for availability checking
  const { data: jobData, isLoading: isLoadingJob } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, start_time, end_time, title")
        .eq("id", jobId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!jobId
  });

  // Use the available technicians hook with proper filtering
  const { 
    technicians: availableTechnicians, 
    isLoading: isLoadingTechnicians 
  } = useAvailableTechnicians({
    department: currentDepartment,
    jobId: jobId,
    jobStartTime: jobData?.start_time || "",
    jobEndTime: jobData?.end_time || "",
    enabled: isOpen && !!jobData && !!jobId
  });

  // Filter technicians to only include technician and house_tech roles
  const filteredTechnicians = availableTechnicians.filter(tech => 
    tech.role === 'technician' || tech.role === 'house_tech'
  );

  // Fetch crew call data for the current job and department
  const { data: crewCallData, isLoading: isLoadingCrewCall } = useCrewCallData(jobId, currentDepartment);

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

    // Process current assignments for Flex integration
    assignments.forEach((assignment) => {
      assignmentsToProcess.push({
        technician_id: assignment.technician_id,
        sound_role: assignment.sound_role,
        lights_role: assignment.lights_role,
      });
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

  const getDepartmentRoleOptions = () => {
    return getDepartmentRoles(currentDepartment);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Manage {currentDepartment} Assignments</span>
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
            Assign available {currentDepartment} technicians to this job.
            {crewCallData?.flex_element_id && (
              <span className="block text-sm text-muted-foreground mt-1">
                Crew call available for {currentDepartment} department.
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
              value={selectedTechnician || ""}
              disabled={isLoadingTechnicians || isLoadingJob}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder={
                  isLoadingTechnicians || isLoadingJob 
                    ? "Loading available technicians..." 
                    : "Select a technician"
                } />
              </SelectTrigger>
              <SelectContent>
                {filteredTechnicians.map((technician) => (
                  <SelectItem key={technician.id} value={technician.id}>
                    {formatAvailableTechnicianName(technician)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentDepartment === "sound" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sound-role" className="text-right">
                Sound Role
              </Label>
              <Select onValueChange={setSoundRole} value={soundRole}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {getDepartmentRoleOptions().map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {currentDepartment === "lights" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lights-role" className="text-right">
                Lights Role
              </Label>
              <Select onValueChange={setLightsRole} value={lightsRole}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {getDepartmentRoleOptions().map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handleAddTechnician}
            disabled={isAdding || !selectedTechnician || isLoadingTechnicians || isLoadingJob}
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
              {assignments.map((assignment) => (
                <div
                  key={assignment.technician_id}
                  className="flex items-center justify-between border rounded-md p-2"
                >
                  <div>
                    {formatAssignmentTechnicianName(assignment)}
                    <p className="text-sm text-muted-foreground">
                      {currentDepartment === "sound" && `Sound: ${assignment.sound_role || "None"}`}
                      {currentDepartment === "lights" && `Lights: ${assignment.lights_role || "None"}`}
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
              ))}
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
