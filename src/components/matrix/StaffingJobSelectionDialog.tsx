import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCancelStaffingRequest } from '@/features/staffing/hooks/useStaffing';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Clock, Mail, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
// Note: This dialog only collects a choice and delegates handling upstream.

interface StaffingJobSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  onStaffingActionSelected: (jobId: string, action: 'availability' | 'offer', options?: { singleDay?: boolean }) => void;
  technicianId: string;
  technicianName: string;
  date: Date;
  availableJobs: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color?: string;
    status: string;
    _assigned_count?: number;
  }>;
  declinedJobIds?: string[];
  preselectedJobId?: string | null;
  forcedAction?: 'availability' | 'offer';
}

export const StaffingJobSelectionDialog = ({ 
  open, 
  onClose, 
  onStaffingActionSelected,
  technicianId,
  technicianName,
  date,
  availableJobs,
  declinedJobIds = [],
  preselectedJobId = null,
  forcedAction
}: StaffingJobSelectionDialogProps) => {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<'availability' | 'offer'>('availability');
  const [singleDay, setSingleDay] = useState<boolean>(false);
  const { mutate: cancelStaffing, isPending: isCancelling } = useCancelStaffingRequest();
  // No direct email sending here; parent handles the action.

  const effectiveAction: 'availability' | 'offer' = forcedAction || selectedAction;

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
  };

  const handleContinue = () => {
    if (selectedJobId) {
      console.log('🚀 StaffingJobSelectionDialog: handleContinue called', {
        job_id: selectedJobId,
        action: selectedAction,
        technician: technicianName,
        date: format(date, 'yyyy-MM-dd'),
        singleDay
      });
      
      // Call the callback to let parent handle it.
      // Do NOT call onClose() here to avoid racing with parent state transitions (e.g., opening OfferDetails).
      onStaffingActionSelected(selectedJobId, effectiveAction, { singleDay });
    } else {
      console.log('❌ StaffingJobSelectionDialog: No job selected');
    }
  };

  const handleClose = () => {
    setSelectedJobId('');
    setSelectedAction('availability');
    setSingleDay(false);
    onClose();
  };

  React.useEffect(() => {
    if (open && preselectedJobId) {
      setSelectedJobId(preselectedJobId);
    }
  }, [open, preselectedJobId]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Staffing Request</DialogTitle>
          <DialogDescription>
            Select a job and action for {technicianName} on{' '}
            {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Select Job</h4>
            {availableJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No jobs available for this date
                </p>
              </div>
            ) : (
              availableJobs.map((job) => {
                const isDeclined = declinedJobIds.includes(job.id);
                const selected = selectedJobId === job.id;
                return (
                  <div
                    key={job.id}
                    className={`p-3 border rounded-lg transition-colors ${
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50'
                    } ${isDeclined ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => {
                      if (isDeclined) return;
                      handleJobSelect(job.id);
                    }}
                    title={isDeclined ? 'Technician declined this job' : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">{job.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(job.start_time), 'HH:mm')} - {format(new Date(job.end_time), 'HH:mm')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isDeclined && <Badge variant="destructive">Declined</Badge>}
                        {job.status === 'Cancelado' && (
                          <Badge variant="destructive" className="text-[10px]">Call these people to cancel</Badge>
                        )}
                        <Badge variant="secondary">{job.status}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Action Selection (hidden if forced) */}
          {selectedJobId && !forcedAction && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Choose Action</h4>
              <RadioGroup value={selectedAction} onValueChange={(value) => setSelectedAction(value as 'availability' | 'offer')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="availability" id="availability" />
                  <Label htmlFor="availability" className="flex items-center gap-2 cursor-pointer">
                    <Mail className="h-4 w-4 text-blue-600" />
                    Ask Availability
                    <span className="text-sm text-muted-foreground">
                      Send email to check if technician is available
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="offer" id="offer" />
                  <Label htmlFor="offer" className="flex items-center gap-2 cursor-pointer">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Send Job Offer
                    <span className="text-sm text-muted-foreground">
                      Send email offering the job to technician
                    </span>
                  </Label>
                </div>
              </RadioGroup>

              <div className="flex items-center gap-2">
                <input id="scope-single-day" type="checkbox" checked={singleDay} onChange={(e) => setSingleDay(e.target.checked)} />
                <Label htmlFor="scope-single-day">Substitute only for this day</Label>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button 
                  variant="outline"
                  disabled={!selectedJobId}
                  onClick={() => {
                    if (!selectedJobId) return;
                    cancelStaffing({ job_id: selectedJobId, profile_id: technicianId, phase: effectiveAction });
                  }}
                >
                  {isCancelling ? 'Cancelling…' : `Cancel ${effectiveAction}`}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleContinue}
            disabled={!selectedJobId}
          >
            {effectiveAction === 'availability' ? 'Ask Availability' : 'Send Offer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
