
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface MarkUnavailableDialogProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  selectedDate: Date;
  selectedCells: string[];
}

export const MarkUnavailableDialog = ({ 
  open, 
  onClose, 
  technicianId, 
  selectedDate,
  selectedCells 
}: MarkUnavailableDialogProps) => {
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');
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

  const availabilityReasons = [
    'vacation',
    'sick_leave',
    'personal_leave',
    'training',
    'travel',
    'other'
  ];

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'vacation':
        return 'Vacation';
      case 'sick_leave':
        return 'Sick Leave';
      case 'personal_leave':
        return 'Personal Leave';
      case 'training':
        return 'Training';
      case 'travel':
        return 'Travel';
      case 'other':
        return 'Other (specify below)';
      default:
        return reason;
    }
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    if (reason === 'other' && !customReason.trim()) {
      toast.error('Please specify the reason');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalReason = reason === 'other' ? customReason : reason;
      
      // Create availability schedule entries
      const { error } = await supabase
        .from('availability_schedules')
        .insert({
          user_id: technicianId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          status: 'unavailable',
          reason: finalReason,
          department: technician?.department || 'general'
        });

      if (error) throw error;

      toast.success(`Marked ${technician?.first_name} ${technician?.last_name} as unavailable`);
      onClose();
    } catch (error) {
      console.error('Error marking unavailable:', error);
      toast.error('Failed to mark as unavailable');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Unavailable</DialogTitle>
          <DialogDescription>
            Mark {technician?.first_name} {technician?.last_name} as unavailable on{' '}
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
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

          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Date</span>
            </div>
            <div className="text-sm">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </div>
            {selectedCells.length > 1 && (
              <div className="text-xs text-muted-foreground mt-1">
                {selectedCells.length} dates selected for bulk update
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reason for Unavailability</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {availabilityReasons.map((reasonOption) => (
                  <SelectItem key={reasonOption} value={reasonOption}>
                    {getReasonLabel(reasonOption)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === 'other' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Specify Reason</label>
              <Textarea
                placeholder="Enter the specific reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!reason || isSubmitting || (reason === 'other' && !customReason.trim())}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Marking...
              </>
            ) : (
              'Mark Unavailable'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
