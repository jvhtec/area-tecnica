
import { useEffect, useState, useCallback } from 'react';
import { FlexUuidService } from '@/services/flexUuidService';
import { supabase } from '@/lib/supabase';

export const useFlexUuid = (identifier: string) => {
  const [flexUuid, setFlexUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlexUuid = useCallback(async () => {
    if (!identifier) {
      setFlexUuid(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log(`[useFlexUuid] Starting fetch for identifier: ${identifier}`);

      // Get current user's department
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[useFlexUuid] No authenticated user found');
        setIsLoading(false);
        setError('User not authenticated');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('department')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('[useFlexUuid] Error fetching user profile:', profileError);
        setIsLoading(false);
        setError('Could not determine user department');
        return;
      }

      if (!profile?.department) {
        console.error('[useFlexUuid] No department found in user profile');
        setIsLoading(false);
        setError('User department not set');
        return;
      }

      console.log(`[useFlexUuid] User department: ${profile.department}`);

      // Use the updated service to get the UUID
      const result = await FlexUuidService.getFlexUuid(identifier, profile.department);

      console.log(`[useFlexUuid] Result for identifier ${identifier}:`, result);
      setFlexUuid(result.uuid);
      setError(result.error);
      setIsLoading(false);
    } catch (error) {
      console.error('[useFlexUuid] Unexpected error:', error);
      setError('Failed to fetch flex UUID');
      setFlexUuid(null);
      setIsLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    fetchFlexUuid();
  }, [fetchFlexUuid]);

  return { flexUuid, isLoading, error, refetch: fetchFlexUuid };
};
