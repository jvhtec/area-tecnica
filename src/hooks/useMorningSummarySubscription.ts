import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export type MorningSummarySubscription = {
  id: string;
  user_id: string;
  subscribed_departments: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Provides read and write operations for the current user's morning summary subscription.
 *
 * The hook fetches the authenticated user's subscription (if any) and exposes a mutation to
 * create or update the subscription. On successful upsert the cached subscription for the
 * current user is invalidated and a success toast is shown; on error an error toast is shown.
 *
 * @returns An object with the following properties:
 * - `subscription` — The user's `MorningSummarySubscription` or `null` if none exists.
 * - `isLoading` — `true` while the subscription query is loading, `false` otherwise.
 * - `error` — The query error object if the fetch failed, otherwise `undefined`.
 * - `upsertSubscription` — A function that accepts `{ subscribed_departments: string[]; enabled: boolean }`
 *   to create or update the current user's subscription.
 * - `isUpdating` — `true` while the upsert mutation is pending, `false` otherwise.
 */
export function useMorningSummarySubscription() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
    }) => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('morning_summary_subscriptions' as any)
        .upsert({
          user_id: userId,
          subscribed_departments: updates.subscribed_departments,
          enabled: updates.enabled,
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