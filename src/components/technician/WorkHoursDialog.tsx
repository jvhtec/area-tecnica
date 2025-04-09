
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "./SignaturePad";
import { supabase } from "@/integrations/supabase/client";

interface WorkHoursDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  jobDate: Date;
  onSubmitSuccess?: () => void;
}

export function WorkHoursDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  jobDate,
  onSubmitSuccess
}: WorkHoursDialogProps) {
  const [workDate, setWorkDate] = useState<string>(format(jobDate, 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [breakDuration, setBreakDuration] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalHours, setTotalHours] = useState<number>(0);

  // Calculate total hours whenever time inputs change
  useEffect(() => {
    if (startTime && endTime) {
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      
      let durationMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
      
      // Handle working past midnight
      if (durationMinutes < 0) {
        durationMinutes += 24 * 60;
      }
      
      // Subtract break duration
      durationMinutes -= breakDuration;
      
      // Convert to hours (with 2 decimal places)
      const hours = Math.max(0, durationMinutes / 60);
      setTotalHours(Math.round(hours * 100) / 100);
    } else {
      setTotalHours(0);
    }
  }, [startTime, endTime, breakDuration]);

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStartTime(e.target.value);
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEndTime(e.target.value);
  };

  const handleBreakDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setBreakDuration(isNaN(value) ? 0 : value);
  };

  const handleSignatureCapture = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
  };

  const handleSubmit = async () => {
    if (!startTime || !endTime) {
      toast.error("Please enter start and end times");
      return;
    }

    if (totalHours <= 0) {
      toast.error("Total working hours must be greater than zero");
      return;
    }

    if (!signatureDataUrl) {
      toast.error("Please provide your signature");
      return;
    }

    setIsSubmitting(true);

    try {
      // First upload the signature to Supabase Storage
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }

      const fileName = `signatures/${user.id}/${jobId}/${new Date().getTime()}.png`;
      
      // Convert data URL to Blob
      const res = await fetch(signatureDataUrl);
      const blob = await res.blob();
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, { contentType: 'image/png' });
      
      if (uploadError) {
        throw uploadError;
      }
      
      // Get public URL for the signature
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);
      
      // Save work record to database
      const { error: insertError } = await supabase
        .from('technician_work_records')
        .insert({
          job_id: jobId,
          technician_id: user.id,
          work_date: workDate,
          start_time: startTime,
          end_time: endTime,
          break_duration: breakDuration,
          total_hours: totalHours,
          signature_url: publicUrlData.publicUrl,
          signature_date: new Date().toISOString(),
          notes: notes,
          status: 'pending'
        });
      
      if (insertError) {
        throw insertError;
      }
      
      toast.success("Work hours submitted successfully");
      onOpenChange(false);
      
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
    } catch (error) {
      console.error("Error submitting work hours:", error);
      toast.error("Failed to submit work hours");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Record Work Hours</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          <div>
            <div className="font-medium mb-1">{jobTitle}</div>
            <div className="text-sm text-muted-foreground mb-4">
              Job ID: {jobId}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="workDate">Work Date</Label>
              <Input
                id="workDate"
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={handleStartTimeChange}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={handleEndTimeChange}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breakDuration">Break Duration (minutes)</Label>
              <Input
                id="breakDuration"
                type="number"
                min="0"
                value={breakDuration}
                onChange={handleBreakDurationChange}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="totalHours">Total Hours</Label>
              <Input
                id="totalHours"
                type="text"
                value={totalHours.toFixed(2)}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes or comments"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Signature</Label>
            <div className="border rounded-md p-4 bg-muted/20">
              <SignaturePad onSignatureCapture={handleSignatureCapture} width={500} height={200} />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
