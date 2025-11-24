
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { labelForCode } from '@/utils/roles';

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
  const queryClient = useQueryClient();

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
    if (!assignment?.job_id) {
      toast.error('No se encontró asignación');
      return;
    }

    setIsSubmitting(true);

    try {
      const newStatus = action === 'confirm' ? 'confirmed' : 'declined';

      console.log('Updating assignment status:', {
        job_id: assignment.job_id,
        technician_id: technicianId,
        current_status: assignment.status,
        new_status: newStatus
      });

      // Use the composite primary key (job_id, technician_id) to update the assignment
      const { data, error } = await supabase
        .from('job_assignments')
        .update({
          status: newStatus,
          response_time: new Date().toISOString(),
        })
        .eq('job_id', assignment.job_id)
        .eq('technician_id', technicianId)
        .select();

      if (error) {
        console.error('Database error details:', error);
        throw error;
      }

      console.log('Update successful:', data);

      // Immediately update the query cache with the new status
      const assignmentQueries = [
        ['optimized-matrix-assignments'],
        ['matrix-assignments'],
        ['job-assignments', assignment.job_id]
      ];

      assignmentQueries.forEach(queryKey => {
        try {
          queryClient.setQueryData(queryKey, (oldData: any) => {
            if (!oldData) return oldData;

            if (Array.isArray(oldData)) {
              return oldData.map((item: any) => {
                if (item.job_id === assignment.job_id && item.technician_id === technicianId) {
                  return { ...item, status: newStatus, response_time: new Date().toISOString() };
                }
                return item;
              });
            }
            return oldData;
          });
        } catch (e: any) {
          if (typeof window !== 'undefined' && e?.name === 'InvalidStateError') {
            console.warn('Broadcast channel closed; skipping optimistic update broadcast');
          } else {
            console.warn('setQueryData error (non-fatal):', e);
          }
        }
      });

      // Invalidate relevant queries to refresh the UI
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['matrix-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['job-assignments', assignment.job_id] })
      ]);

      if (newStatus === 'confirmed') {
        const recipientName = `${technician?.first_name ?? ''} ${technician?.last_name ?? ''}`.trim();
        try {
          void supabase.functions.invoke('push', {
            body: {
              action: 'broadcast',
              type: 'job.assignment.confirmed',
              job_id: assignment.job_id,
              recipient_id: technicianId,
              recipient_name: recipientName || undefined
            }
          });
        } catch (_) {
          // Ignore push errors
        }
      }

      const statusText = action === 'confirm' ? 'confirmed' : 'declined';
      toast.success(
        `Asignación ${statusText === 'confirmed' ? 'confirmada' : 'rechazada'} para ${technician?.first_name} ${technician?.last_name}`
      );
      onClose();
    } catch (error: any) {
      console.error('Error updating assignment status:', error);

      // More detailed error message
      const errorMessage = error?.message || 'Unknown database error';
      toast.error(`Error al actualizar el estado de la asignación: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionConfig = {
    confirm: {
      title: 'Confirmar Asignación',
      description: 'Confirmar esta asignación como definitiva',
      buttonText: 'Confirmar Asignación',
      buttonClass: 'bg-green-600 hover:bg-green-700',
      icon: <Check className="mr-2 h-4 w-4" />
    },
    decline: {
      title: 'Rechazar Asignación',
      description: 'Rechazar esta asignación',
      buttonText: 'Rechazar Asignación',
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
            {config.description} para {technician?.first_name} {technician?.last_name} el{' '}
            {format(date, 'EEEE, d MMMM, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {technician && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Técnico:</span>
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
                  {labelForCode(assignment.sound_role || assignment.lights_role || assignment.video_role)}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                Estado actual: <Badge variant="secondary">{assignment.status}</Badge>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Notas (Opcional)</label>
            <Textarea
              placeholder={`Añadir notas sobre esta ${action === 'confirm' ? 'confirmación' : 'cancelación'}...`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={config.buttonClass}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
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
