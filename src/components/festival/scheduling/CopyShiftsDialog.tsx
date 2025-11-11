
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface CopyShiftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceDate: string;
  jobDates: Date[];
  jobId: string;
  onShiftsCopied: () => void;
}

export const CopyShiftsDialog = ({ 
  open, 
  onOpenChange, 
  sourceDate, 
  jobDates,
  jobId,
  onShiftsCopied 
}: CopyShiftsDialogProps) => {
  const [targetDate, setTargetDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    if (!targetDate) {
      toast.error("Por favor selecciona una fecha destino");
      return;
    }

    try {
      setIsLoading(true);
      console.log(`Starting copy operation from ${sourceDate} to ${targetDate} for job ${jobId}`);

      // Fetch source shifts and their assignments
      const { data: shifts, error: shiftsError } = await supabase
        .from("festival_shifts")
        .select(`
          id,
          name,
          start_time,
          end_time,
          department,
          stage,
          notes
        `)
        .eq("job_id", jobId)
        .eq("date", sourceDate);

      if (shiftsError) {
        console.error("Error fetching source shifts:", shiftsError);
        throw shiftsError;
      }

      if (!shifts || shifts.length === 0) {
        toast.error("No se encontraron turnos para la fecha de origen seleccionada");
        return;
      }

      console.log(`Found ${shifts.length} shifts to copy:`, shifts);

      // For each shift, create a new one and copy its assignments
      for (const shift of shifts) {
        console.log(`Copying shift: ${shift.name} (ID: ${shift.id})`);
        
        const { data: newShift, error: newShiftError } = await supabase
          .from("festival_shifts")
          .insert({
            name: shift.name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            department: shift.department,
            stage: shift.stage,
            notes: shift.notes,
            date: targetDate,
            job_id: jobId
          })
          .select()
          .single();

        if (newShiftError) {
          console.error("Error creating new shift:", newShiftError);
          throw newShiftError;
        }

        console.log(`Created new shift with ID: ${newShift.id}`);

        // Get assignments for the source shift
        const { data: assignments, error: assignmentsError } = await supabase
          .from("festival_shift_assignments")
          .select("*")
          .eq("shift_id", shift.id);

        if (assignmentsError) {
          console.error("Error fetching assignments:", assignmentsError);
          throw assignmentsError;
        }

        console.log(`Found ${assignments?.length || 0} assignments for shift ${shift.id}:`, assignments);

        // Create new assignments for the new shift
        if (assignments && assignments.length > 0) {
          const newAssignments = assignments.map(assignment => ({
            shift_id: newShift.id,
            technician_id: assignment.technician_id,
            external_technician_name: assignment.external_technician_name,
            role: assignment.role
          }));

          console.log("Creating new assignments:", newAssignments);

          const { error: insertError } = await supabase
            .from("festival_shift_assignments")
            .insert(newAssignments);

          if (insertError) {
            console.error("Error creating assignments:", insertError);
            throw insertError;
          }

          console.log(`Successfully created ${newAssignments.length} assignments for new shift`);
        }
      }

      console.log("Copy operation completed successfully");
      toast.success(`Se copiaron exitosamente ${shifts.length} turnos con todas las asignaciones a ${format(new Date(targetDate), 'MMM d, yyyy')}`);

      // Call the callback to refresh data
      onShiftsCopied();
      onOpenChange(false);

    } catch (error: any) {
      console.error("Error copying shifts:", error);
      toast.error(`Error al copiar turnos: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Copiar Turnos a Otra Fecha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Fecha de origen: {format(new Date(sourceDate), 'MMM d, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Esto copiará todos los turnos y sus técnicos asignados a la fecha destino.
            </p>
            <Select
              value={targetDate}
              onValueChange={setTargetDate}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar fecha destino" />
              </SelectTrigger>
              <SelectContent>
                {jobDates.map((date) => {
                  const formattedDate = format(date, 'yyyy-MM-dd');
                  if (formattedDate === sourceDate) return null;
                  return (
                    <SelectItem key={formattedDate} value={formattedDate}>
                      {format(date, 'MMM d, yyyy')}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCopy}
              disabled={!targetDate || isLoading}
            >
              {isLoading ? "Copiando..." : "Copiar Turnos y Asignaciones"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
