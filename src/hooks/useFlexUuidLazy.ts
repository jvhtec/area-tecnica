
import { useState, useCallback } from 'react';
import { FlexUuidService } from '@/services/flexUuidService';
import { supabase } from '@/lib/supabase';

interface FlexUuidState {
  uuid: string | null;
  isLoading: boolean;
  error: string | null;
  hasChecked: boolean;
}

const flexUuidCache = new Map<string, { uuid: string | null; error: string | null; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useFlexUuidLazy = () => {
  const [state, setState] = useState<FlexUuidState>({
    uuid: null,
    isLoading: false,
    error: null,
    hasChecked: false
  });

  const fetchFlexUuid = useCallback(async (identifier: string) => {
    if (!identifier) {
      setState({ uuid: null, isLoading: false, error: null, hasChecked: true });
      return;
    }

    // Check cache first
    const cached = flexUuidCache.get(identifier);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      setState({
        uuid: cached.uuid,
        isLoading: false,
        error: cached.error,
        hasChecked: true
      });
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, hasChecked: true }));

    try {
      console.log(`[useFlexUuidLazy] Fetching flex UUID for identifier: ${identifier}`);

      // Get current user's department
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const error = 'User not authenticated';
        setState({ uuid: null, isLoading: false, error, hasChecked: true });
        flexUuidCache.set(identifier, { uuid: null, error, timestamp: now });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('department')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.department) {
        const error = 'Could not determine user department';
        setState({ uuid: null, isLoading: false, error, hasChecked: true });
        flexUuidCache.set(identifier, { uuid: null, error, timestamp: now });
        return;
      }

      const result = await FlexUuidService.getFlexUuid(identifier, profile.department);
      
      setState({
        uuid: result.uuid,
        isLoading: false,
        error: result.error,
        hasChecked: true
      });

      // Cache the result
      flexUuidCache.set(identifier, {
        uuid: result.uuid,
        error: result.error,
        timestamp: now
      });

    } catch (error) {
      console.error('[useFlexUuidLazy] Unexpected error:', error);
      const errorMessage = 'Failed to fetch flex UUID';
      setState({ uuid: null, isLoading: false, error: errorMessage, hasChecked: true });
      flexUuidCache.set(identifier, { uuid: null, error: errorMessage, timestamp: now });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ uuid: null, isLoading: false, error: null, hasChecked: false });
  }, []);

  return {
    ...state,
    fetchFlexUuid,
    reset
  };
};
