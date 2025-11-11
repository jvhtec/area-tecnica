
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FestivalShift, ShiftWithAssignments } from "@/types/festival-scheduling";
import { Department } from "@/types/department";
import { roleOptionsForDiscipline, labelForCode } from '@/utils/roles';
import { Switch } from "@/components/ui/switch";

interface ManageAssignmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftWithAssignments;
  onAssignmentsUpdated: () => void;
  isViewOnly?: boolean;
}

// Define a type for the technician object
interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  role: string;
}

// Define the structure for the job_assignments response from Supabase
interface JobAssignmentResponse {
  technician_id: string;
  profiles: Technician;
}

export const ManageAssignmentsDialog = ({ 
  open, 
  onOpenChange, 
  shift, 
  onAssignmentsUpdated,
  isViewOnly = false
}: ManageAssignmentsDialogProps) => {
  const [technicianId, setTechnicianId] = useState("");
  const [externalTechnicianName, setExternalTechnicianName] = useState("");
  const [isExternalTechnician, setIsExternalTechnician] = useState(false);
  const [role, setRole] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set a default role when dialog opens based on department
  useEffect(() => {
    if (open && shift.department) {
      const opts = roleOptionsForDiscipline(String(shift.department));
      if (opts.length > 0) {
        setRole(opts[0].code);
      }
    }
  }, [open, shift.department]);

  const { data: technicians, isLoading: isLoadingTechnicians, error: techniciansError } = useQuery({
    queryKey: ["job-technicians", shift.job_id, shift.department],
    queryFn: async () => {
      const departmentFilter = shift.department || "sound";
      
      // First, get assigned technicians for this job and department
      const { data, error } = await supabase
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
        .eq("job_id", shift.job_id);

      if (error) {
        console.error("Error fetching job assignments:", error);
        throw error;
      }

      // Filter by department and map to get just the profiles
      const filteredTechnicians = data
        .filter((assignment: any) => 
          assignment.profiles && 
          assignment.profiles.department === departmentFilter
        )
        .map((assignment: any) => assignment.profiles);

      console.log(`Found ${filteredTechnicians.length} technicians assigned to job ${shift.job_id} for department ${departmentFilter}`);
      return filteredTechnicians as Technician[];
    },
  });

  // Function to get department-specific role options
  const getRoleOptions = (department: Department): string[] => {
    const opts = roleOptionsForDiscipline(String(department));
    return opts.map(o => o.code);
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

  const addAssignmentMutation = useMutation({
    mutationFn: async (assignment: { shift_id: string; technician_id?: string; external_technician_name?: string; role: string }) => {
      if (!shift?.id) {
        throw new Error("Shift ID is required");
      }

      const { data, error } = await supabase
        .from("festival_shift_assignments")
        .insert([assignment]);

      if (error) {
        console.error("Error adding assignment:", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festivalShifts"] });
      onAssignmentsUpdated();
      toast({
        title: "Éxito",
        description: "Técnico asignado exitosamente",
      });
    },
    onError: (error: any) => {
      console.error("Error adding assignment:", error);
      toast({
        title: "Error",
        description: "No se pudo asignar el técnico",
        variant: "destructive",
      });
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["festivalShifts"] });
      onAssignmentsUpdated();
      toast({
        title: "Éxito",
        description: "Técnico desasignado exitosamente",
      });
    },
    onError: (error: any) => {
      console.error("Error removing assignment:", error);
      toast({
        title: "Error",
        description: "No se pudo desasignar el técnico",
        variant: "destructive",
      });
    },
  });

  const handleAddAssignment = async () => {
    if ((!technicianId && !externalTechnicianName) || !role) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    try {
      const assignment = {
        shift_id: shift.id,
        role: role,
        ...(isExternalTechnician 
          ? { external_technician_name: externalTechnicianName }
          : { technician_id: technicianId }
        )
      };

      await addAssignmentMutation.mutateAsync(assignment);
      
      // Reset form
      setTechnicianId("");
      setExternalTechnicianName("");
      setRole("");
    } catch (error: any) {
      console.error("Error adding assignment:", error);
      toast({
        title: "Error",
        description: "No se pudo asignar el técnico",
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
        description: "No se pudo desasignar el técnico",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">
            {isViewOnly ? "Ver Personal para" : "Gestionar Personal para"} {shift.name}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isViewOnly
              ? "Ver personal asignado a este turno"
              : "Añadir o eliminar personal de este turno"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] px-1">
          <div className="space-y-6">
            {!isViewOnly && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={isExternalTechnician}
                    onCheckedChange={setIsExternalTechnician}
                  />
                  <Label>Técnico Externo</Label>
                </div>

                {isExternalTechnician ? (
                  <div className="grid gap-2">
                    <Label htmlFor="externalTechnician">Nombre del Técnico Externo</Label>
                    <Input
                      id="externalTechnician"
                      value={externalTechnicianName}
                      onChange={(e) => setExternalTechnicianName(e.target.value)}
                      placeholder="Ingresar nombre del técnico"
                    />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="technician">Técnico</Label>
                    <Select onValueChange={setTechnicianId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar un técnico" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSortedTechnicians().map((technician) => (
                          <SelectItem key={technician.id} value={technician.id}>
                            {formatTechnicianName(technician)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select
                    value={role}
                    onValueChange={setRole}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {getRoleOptions(shift.department as Department || "sound").map((code) => (
                        <SelectItem key={code} value={code}>
                          {labelForCode(code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddAssignment} disabled={addAssignmentMutation.isPending}>
                  {addAssignmentMutation.isPending ? "Asignando..." : "Asignar Técnico"}
                </Button>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-medium">Personal Asignado</h3>
              {shift.assignments.length > 0 ? (
                <div className="space-y-2">
                  {shift.assignments.map(assignment => (
                    <div key={assignment.id} className="flex items-center justify-between p-2 bg-accent/20 rounded-md">
                      <div>
                        {assignment.external_technician_name || 
                          `${assignment.profiles?.first_name} ${assignment.profiles?.last_name}`} 
                        - {labelForCode(assignment.role) || assignment.role}
                      </div>
                      {!isViewOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAssignment(assignment.id)}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Aún no hay personal asignado a este turno.</div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-6">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
