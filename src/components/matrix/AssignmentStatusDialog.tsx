
import React, { useState, useCallback, useRef } from 'react';
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
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { labelForCode } from '@/utils/roles';

interface AssignmentStatusDialogProps {
  open: boolean;
  onClose: () => void;
  technicianId: string;
  date: Date;
  assignment: any;
  action: 'confirm' | 'decline';
}

// Query keys for cache management
const ASSIGNMENT_QUERY_KEYS = [
  ['optimized-matrix-assignments'],
  ['matrix-assignments'],
] as const;

export const AssignmentStatusDialog = ({
  open,
  onClose,
  technicianId,
  date,
  assignment,
  action
}: AssignmentStatusDialogProps) => {
  const [notes, setNotes] = useState('');
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

  // Mutation with proper optimistic update and rollback
  const assignmentMutation = useMutation({
    mutationFn: async ({
      jobId,
      techId,
      actionType,
      isTourAssignment
    }: {
      jobId: string;
      techId: string;
      actionType: 'confirm' | 'decline';
      isTourAssignment: boolean;
    }) => {
      // Use atomic RPC for transactional safety
      const { data, error } = await supabase.rpc('manage_assignment_lifecycle', {
        p_job_id: jobId,
        p_technician_id: techId,
        p_action: actionType,
        p_delete_mode: isTourAssignment ? 'hard' : 'soft',
        p_metadata: { notes, source: 'matrix_dialog' }
      });

      if (error) {
        console.error('RPC error:', error);
        throw new Error(error.message || 'Database operation failed');
      }

      // Check RPC result
      if (!data?.success) {
        const errorMessage = data?.message || data?.error || 'Operation failed';
        console.error('RPC returned failure:', data);
        throw new Error(errorMessage);
      }

      return data;
    },

    // Save previous cache state BEFORE mutation
    onMutate: async (variables) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['optimized-matrix-assignments'] });
      await queryClient.cancelQueries({ queryKey: ['matrix-assignments'] });
      await queryClient.cancelQueries({ queryKey: ['job-assignments', variables.jobId] });

      // Snapshot the previous values for rollback
      const previousData: Record<string, unknown> = {};

      ASSIGNMENT_QUERY_KEYS.forEach(queryKey => {
        previousData[JSON.stringify(queryKey)] = queryClient.getQueryData(queryKey);
      });
      previousData[JSON.stringify(['job-assignments', variables.jobId])] =
        queryClient.getQueryData(['job-assignments', variables.jobId]);

      // Optimistically update the cache
      const newStatus = variables.actionType === 'confirm' ? 'confirmed' : 'declined';

      [...ASSIGNMENT_QUERY_KEYS, ['job-assignments', variables.jobId]].forEach(queryKey => {
        try {
          queryClient.setQueryData(queryKey, (oldData: any) => {
            if (!oldData) return oldData;
            if (Array.isArray(oldData)) {
              return oldData.map((item: any) => {
                if (item.job_id === variables.jobId && item.technician_id === variables.techId) {
                  return { ...item, status: newStatus, response_time: new Date().toISOString() };
                }
                return item;
              });
            }
            return oldData;
          });
        } catch (e: any) {
          if (typeof window !== 'undefined' && e?.name === 'InvalidStateError') {
            console.warn('Broadcast channel closed; skipping optimistic update');
          }
        }
      });

      // Return context with previous data for rollback
      return { previousData, jobId: variables.jobId };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      console.error('Assignment mutation failed, rolling back:', err);

      // Restore all previous cache values
      if (context?.previousData) {
        Object.entries(context.previousData).forEach(([keyString, value]) => {
          try {
            const queryKey = JSON.parse(keyString);
            queryClient.setQueryData(queryKey, value);
          } catch (e) {
            console.warn('Failed to restore cache for key:', keyString);
          }
        });
      }

      // Show error to user
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      toast.error(`Error al actualizar la asignación: ${errorMessage}`);
    },

    // On success, invalidate queries to refetch from server
    onSuccess: (data, variables) => {
      console.log('Assignment operation successful:', data);

      // Invalidate all relevant queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['optimized-matrix-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['matrix-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['job-assignments', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-details', variables.jobId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['optimized-jobs'] });

      // Send push notification for confirmations
      if (variables.actionType === 'confirm') {
        const recipientName = `${technician?.first_name ?? ''} ${technician?.last_name ?? ''}`.trim();
        supabase.functions.invoke('push', {
          body: {
            action: 'broadcast',
            type: 'job.assignment.confirmed',
            job_id: variables.jobId,
            recipient_id: variables.techId,
            recipient_name: recipientName || undefined
          }
        }).catch(() => { /* Ignore push errors */ });
      }

      // Show success message
      const statusText = variables.actionType === 'confirm' ? 'confirmada' : 'rechazada';
      toast.success(
        `Asignación ${statusText} para ${technician?.first_name ?? ''} ${technician?.last_name ?? ''}`
      );

      onClose();
    }
  });

  const handleSubmit = useCallback(async () => {
    if (!assignment?.job_id) {
      toast.error('No se encontró asignación');
      return;
    }

    // Check if tour assignment to determine delete mode
    const { data: jobAssignment } = await supabase
      .from('job_assignments')
      .select('assignment_source')
      .eq('job_id', assignment.job_id)
      .eq('technician_id', technicianId)
      .maybeSingle();

    const isTourAssignment = jobAssignment?.assignment_source === 'tour';

    // Execute the mutation
    assignmentMutation.mutate({
      jobId: assignment.job_id,
      techId: technicianId,
      actionType: action,
      isTourAssignment
    });
  }, [assignment?.job_id, technicianId, action, assignmentMutation]);

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
            disabled={assignmentMutation.isPending}
            className={config.buttonClass}
          >
            {assignmentMutation.isPending ? (
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
