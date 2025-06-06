
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
      toast.error("Please select a target date");
      return;
    }

    try {
      setIsLoading(true);

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

      if (shiftsError) throw shiftsError;

      // For each shift, create a new one and copy its assignments
      for (const shift of shifts || []) {
        const { data: newShift, error: newShiftError } = await supabase
          .from("festival_shifts")
          .insert({
            ...shift,
            id: undefined,
            date: targetDate,
            job_id: jobId
          })
          .select()
          .single();

        if (newShiftError) throw newShiftError;

        // Get assignments for the source shift
        const { data: assignments, error: assignmentsError } = await supabase
          .from("festival_shift_assignments")
          .select("*")
          .eq("shift_id", shift.id);

        if (assignmentsError) throw assignmentsError;

        // Create new assignments for the new shift
        if (assignments && assignments.length > 0) {
          const newAssignments = assignments.map(assignment => ({
            ...assignment,
            id: undefined,
            shift_id: newShift.id
          }));

          const { error: insertError } = await supabase
            .from("festival_shift_assignments")
            .insert(newAssignments);

          if (insertError) throw insertError;
        }
      }

      toast.success("Shifts copied successfully");
      onShiftsCopied();
      onOpenChange(false);
    } catch (error) {
      console.error("Error copying shifts:", error);
      toast.error("Failed to copy shifts");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy Shifts to Another Date</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Source date: {format(new Date(sourceDate), 'MMM d, yyyy')}
            </p>
            <Select
              value={targetDate}
              onValueChange={setTargetDate}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target date" />
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
            >
              Cancel
            </Button>
            <Button
              onClick={handleCopy}
              disabled={!targetDate || isLoading}
            >
              {isLoading ? "Copying..." : "Copy Shifts"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
