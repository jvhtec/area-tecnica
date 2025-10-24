
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ShiftWithAssignments } from "@/types/festival-scheduling";
import { ShiftTimeCalculator } from "./ShiftTimeCalculator";

interface EditShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftWithAssignments;
  onShiftUpdated: () => void;
}

const formSchema = z.object({
  name: z.string().min(1, "Shift name is required"),
  start_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Valid time format is required (HH:MM)"),
  end_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Valid time format is required (HH:MM)"),
  stage: z.string().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export const EditShiftDialog = ({ 
  open, 
  onOpenChange, 
  shift,
  onShiftUpdated 
}: EditShiftDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      stage: shift.stage?.toString() || "",
      department: shift.department || "",
      notes: shift.notes || "",
    },
  });

  const handleApplyCalculatedTimes = (startTime: string, endTime: string) => {
    form.setValue("start_time", startTime);
    form.setValue("end_time", endTime);
  };

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("festival_shifts")
        .update({
          name: values.name,
          start_time: values.start_time,
          end_time: values.end_time,
          stage: values.stage && values.stage !== "none" ? parseInt(values.stage) : null,
          department: values.department && values.department !== "none" ? values.department : null,
          notes: values.notes || null,
        })
        .eq("id", shift.id);

      if (error) throw error;
      
      onShiftUpdated();
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Shift updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating shift:", error);
      toast({
        title: "Error",
        description: "Could not update shift",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Edit Shift</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Shift Name</Label>
            <Input
              id="name"
              placeholder="Morning Shift, Sound Check, etc."
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <ShiftTimeCalculator 
            jobId={shift.job_id} 
            date={shift.date} 
            stage={form.watch("stage") ? parseInt(form.watch("stage")) : undefined}
            onApplyTimes={handleApplyCalculatedTimes}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                {...form.register("start_time")}
              />
              {form.formState.errors.start_time && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.start_time.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                {...form.register("end_time")}
              />
              {form.formState.errors.end_time && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.end_time.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stage">Stage (optional)</Label>
              <Select 
                defaultValue={form.getValues("stage") || "none"}
                onValueChange={(value) => form.setValue("stage", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No stage</SelectItem>
                  <SelectItem value="1">Stage 1</SelectItem>
                  <SelectItem value="2">Stage 2</SelectItem>
                  <SelectItem value="3">Stage 3</SelectItem>
                  <SelectItem value="4">Stage 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department (optional)</Label>
              <Select 
                defaultValue={form.getValues("department") || "none"}
                onValueChange={(value) => form.setValue("department", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  <SelectItem value="sound">Sound</SelectItem>
                  <SelectItem value="lights">Lights</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information about this shift"
              {...form.register("notes")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Shift"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
