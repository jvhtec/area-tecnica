import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type PushNotificationSchedule = {
  id: string;
  event_type: string;
  enabled: boolean;
  schedule_time: string; // HH:MM:SS
  timezone: string;
  days_of_week: number[]; // 1=Monday, 7=Sunday
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export function usePushNotificationSchedule(eventType: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedule, isLoading, error } = useQuery({
    queryKey: ['push-notification-schedule', eventType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('push_notification_schedules')
        .select('*')
        .eq('event_type', eventType)
        .maybeSingle();

      if (error) throw error;
      return data as PushNotificationSchedule | null;
    },
  });

  const updateSchedule = useMutation({
    mutationFn: async (updates: Partial<PushNotificationSchedule>) => {
      const { data, error } = await supabase
        .from('push_notification_schedules')
        .update(updates)
        .eq('event_type', eventType)
        .select()
        .single();

      if (error) throw error;
      return data as PushNotificationSchedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['push-notification-schedule', eventType] });
      toast({
        title: 'Configuración actualizada',
        description: 'Los cambios en la programación se han guardado correctamente.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    schedule,
    isLoading,
    error,
    updateSchedule: updateSchedule.mutate,
    isUpdating: updateSchedule.isPending,
  };
}
