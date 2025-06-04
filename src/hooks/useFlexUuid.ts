
import { useEffect, useState } from 'react';
import { FlexUuidService } from '@/services/flexUuidService';
import { supabase } from '@/lib/supabase';

export const useFlexUuid = (jobId: string) => {
  const [flexUuid, setFlexUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchFlexUuid = async () => {
      if (!jobId) {
        setFlexUuid(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        console.log(`[useFlexUuid] Starting fetch for job ID: ${jobId}`);

        // Get current user's department
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[useFlexUuid] No authenticated user found');
          if (!isCancelled) {
            setIsLoading(false);
            setError('User not authenticated');
          }
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('department')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('[useFlexUuid] Error fetching user profile:', profileError);
          if (!isCancelled) {
            setIsLoading(false);
            setError('Could not determine user department');
          }
          return;
        }

        if (!profile?.department) {
          console.error('[useFlexUuid] No department found in user profile');
          if (!isCancelled) {
            setIsLoading(false);
            setError('User department not set');
          }
          return;
        }

        console.log(`[useFlexUuid] User department: ${profile.department}`);

        // Use the corrected service to get the UUID
        const result = await FlexUuidService.getFlexUuid(jobId, profile.department);

        if (!isCancelled) {
          console.log(`[useFlexUuid] Result for job ${jobId}:`, result);
          setFlexUuid(result.uuid);
          setError(result.error);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[useFlexUuid] Unexpected error:', error);
        if (!isCancelled) {
          setError('Failed to fetch flex UUID');
          setFlexUuid(null);
          setIsLoading(false);
        }
      }
    };

    fetchFlexUuid();

    return () => {
      isCancelled = true;
    };
  }, [jobId]);

  return { flexUuid, isLoading, error };
};
