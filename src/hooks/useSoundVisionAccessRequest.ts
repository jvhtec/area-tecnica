import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { VacationRequest } from '@/lib/vacation-requests';

const SOUNDVISION_REQUEST_PREFIX = '[SoundVision Access]';

interface SoundVisionAccessRequestParams {
  note: string;
}

/**
 * Hook to manage SoundVision access requests
 * - Reuses vacation_requests table with same-day start/end
 * - Detects duplicate pending entries
 * - Submits with standardized reason prefix
 * - Creates message for sound department
 * - Dispatches invalidation events
 * - Sends push notifications to sound management/admin
 */
export const useSoundVisionAccessRequest = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing SoundVision access requests for current user
  const soundVisionRequestsQuery = useQuery({
    queryKey: ['soundvision-access-requests', 'user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('vacation_requests')
        .select(`
          *,
          technicians:profiles!technician_id(first_name, last_name, department, email)
        `)
        .eq('technician_id', user.id)
        .eq('start_date', 'end_date') // Same-day requests indicate SoundVision access
        .ilike('reason', `${SOUNDVISION_REQUEST_PREFIX}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as VacationRequest[];
    },
  });

  // Check if user has a pending request
  const hasPendingRequest = (soundVisionRequestsQuery.data || []).some(
    (req) => req.status === 'pending'
  );

  // Submit new SoundVision access request
  const submitRequestMutation = useMutation({
    mutationFn: async ({ note }: SoundVisionAccessRequestParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Check for duplicate pending requests
      if (hasPendingRequest) {
        throw new Error('You already have a pending SoundVision access request');
      }

      // Create vacation request with same-day dates
      const today = new Date().toISOString().split('T')[0];
      const reason = `${SOUNDVISION_REQUEST_PREFIX} ${note}`;

      const { data: vacationRequest, error: vacationError } = await supabase
        .from('vacation_requests')
        .insert({
          technician_id: user.id,
          start_date: today,
          end_date: today,
          reason: reason,
          status: 'pending'
        })
        .select()
        .single();

      if (vacationError) throw vacationError;

      // Get user profile for message
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      const userName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
      const messageContent = `SoundVision Access Request from ${userName}:\n\n${note}`;

      // Insert message to sound department
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          content: messageContent,
          department: 'sound',
          sender_id: user.id,
          status: 'unread',
          metadata: {
            type: 'soundvision_access_request',
            vacation_request_id: vacationRequest.id
          }
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Get sound management and admin user IDs for notifications
      const { data: soundManagers, error: managersError } = await supabase
        .from('profiles')
        .select('id')
        .or('role.eq.admin,and(role.eq.management,department.eq.sound)');

      if (managersError) {
        console.warn('Failed to fetch sound managers for notifications:', managersError);
      }

      const recipientIds = soundManagers?.map((m) => m.id).filter(Boolean) || [];

      // Send push notifications to each recipient
      if (recipientIds.length > 0) {
        try {
          // Fan out notifications per recipient
          await Promise.all(
            recipientIds.map((recipientId) =>
              supabase.functions.invoke('push', {
                body: {
                  action: 'broadcast',
                  type: 'message.received',
                  recipient_id: recipientId,
                  message_preview: note.substring(0, 100),
                  message_id: message.id,
                  actor_name: userName,
                  url: '/messages'
                }
              })
            )
          );
        } catch (pushError) {
          console.warn('Failed to send push notifications:', pushError);
          // Don't fail the whole operation if push fails
        }
      }

      return { vacationRequest, message };
    },
    onSuccess: () => {
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['soundvision-access-requests'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      // Invalidate all messages queries (will invalidate for all roles/departments)
      queryClient.invalidateQueries({ queryKey: ['messages'] });

      // Dispatch local invalidation events for cross-tab coordination
      try {
        window.dispatchEvent(new Event('messages_invalidated'));
        window.dispatchEvent(new Event('vacation_requests_invalidated'));
      } catch (e) {
        // Ignore in non-browser environments
        console.warn('Failed to dispatch events:', e);
      }

      toast({
        title: 'Request submitted!',
        description: 'Your SoundVision access request has been submitted for approval.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error submitting request',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });

  return {
    soundVisionRequests: soundVisionRequestsQuery.data || [],
    isLoadingRequests: soundVisionRequestsQuery.isLoading,
    hasPendingRequest,
    submitRequest: submitRequestMutation.mutate,
    isSubmitting: submitRequestMutation.isPending,
    currentStatus: hasPendingRequest 
      ? 'pending' 
      : soundVisionRequestsQuery.data?.find((r) => r.status === 'approved')
      ? 'approved'
      : soundVisionRequestsQuery.data?.find((r) => r.status === 'rejected')
      ? 'rejected'
      : null,
  };
};
