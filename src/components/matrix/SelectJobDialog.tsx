
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
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface SelectJobDialogProps {
  open: boolean;
  onClose: () => void;
  onJobSelected: (jobId: string) => void;
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
}

export const SelectJobDialog = ({ 
  open, 
  onClose, 
  onJobSelected,
  technicianName,
  date,
  availableJobs
}: SelectJobDialogProps) => {
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
  };

  const handleContinue = () => {
    if (selectedJobId) {
      onJobSelected(selectedJobId);
    }
  };

  const handleClose = () => {
    setSelectedJobId('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Job</DialogTitle>
          <DialogDescription>
            Select a job to assign {technicianName} to on{' '}
            {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {availableJobs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No jobs available for this date
              </p>
            </div>
          ) : (
            availableJobs.map((job) => (
              <div
                key={job.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedJobId === job.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/50'
                }`}
                onClick={() => handleJobSelect(job.id)}
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
                    {job.status === 'Cancelado' && (
                      <Badge variant="destructive" className="text-[10px]">Call these people to cancel</Badge>
                    )}
                    <Badge variant="secondary">{job.status}</Badge>
                  </div>
                </div>
              </div>
            ))
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
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
