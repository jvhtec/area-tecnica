
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface AssignmentStatusDialogProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  date: Date;
  assignment: any;
  action: 'confirm' | 'decline';
}

export const AssignmentStatusDialog = ({ 
  open, 
  onClose, 
  technicianId, 
  date, 
  assignment,
  action
}: AssignmentStatusDialogProps) => {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get technician details
  const { data: technician } = useQuery({
    queryKey: ['technician', technicianId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, department')
        .eq('id', technicianId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!technicianId
  });

  const handleSubmit = async () => {
    if (!assignment) {
      toast.error('No assignment found');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('job_assignments')
        .update({
          status: action,
          response_time: new Date().toISOString(),
          // Could add notes field in future if needed
        })
        .eq('job_id', assignment.job_id)
        .eq('technician_id', technicianId);

      if (error) throw error;

      toast.success(
        action === 'confirm' 
          ? `Assignment confirmed for ${technician?.first_name} ${technician?.last_name}`
          : `Assignment declined for ${technician?.first_name} ${technician?.last_name}`
      );
      onClose();
    } catch (error) {
      console.error('Error updating assignment status:', error);
      toast.error('Failed to update assignment status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionConfig = {
    confirm: {
      title: 'Confirm Assignment',
      description: 'Confirm this assignment as final',
      buttonText: 'Confirm Assignment',
      buttonClass: 'bg-green-600 hover:bg-green-700',
      icon: <Check className="mr-2 h-4 w-4" />
    },
    decline: {
      title: 'Decline Assignment',
      description: 'Decline this assignment',
      buttonText: 'Decline Assignment',
      buttonClass: 'bg-red-600 hover:bg-red-700',
      icon: <X className="mr-2 h-4 w-4" />
    }
  };

  const config = actionConfig[action];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>
            {config.description} for {technician?.first_name} {technician?.last_name} on{' '}
            {format(date, 'EEEE, MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {technician && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Technician:</span>
              <span>{technician.first_name} {technician.last_name}</span>
              <Badge variant="outline">{technician.department}</Badge>
            </div>
          )}

          {assignment?.jobs && (
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">{assignment.jobs.title}</span>
                <Badge variant="secondary">
                  {assignment.sound_role || assignment.lights_role || assignment.video_role}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Current status: <Badge variant="secondary">{assignment.status}</Badge>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <Textarea
              placeholder={`Add notes about this ${action}...`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={config.buttonClass}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {config.icon}
                {config.buttonText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
