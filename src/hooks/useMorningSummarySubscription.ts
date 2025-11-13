import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';

export type MorningSummarySubscription = {
  id: string;
  user_id: string;
  subscribed_departments: string[];
  enabled: boolean;
  schedule_time: string;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useMorningSummarySubscription() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useOptimizedAuth();
  const userId = user?.id;

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['morning-summary-subscription', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('morning_summary_subscriptions' as any)
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as MorningSummarySubscription | null;
    },
    enabled: !!userId,
  });

  const upsertSubscription = useMutation({
    mutationFn: async (updates: {
      subscribed_departments: string[];
      enabled: boolean;
      schedule_time: string;
    }) => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('morning_summary_subscriptions' as any)
        .upsert({
          user_id: userId,
          subscribed_departments: updates.subscribed_departments,
          enabled: updates.enabled,
          schedule_time: updates.schedule_time,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as MorningSummarySubscription;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['morning-summary-subscription', userId] });
      toast({
        title: 'Suscripción actualizada',
        description: 'Tus preferencias de resumen diario se han guardado correctamente.',
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
    subscription,
    isLoading,
    error,
    upsertSubscription: upsertSubscription.mutate,
    isUpdating: upsertSubscription.isPending,
  };
}
