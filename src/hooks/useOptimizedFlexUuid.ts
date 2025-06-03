
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FlexUuidService } from '@/services/flexUuidService';

export const useOptimizedFlexUuid = (jobId: string) => {
  const [flexUuid, setFlexUuid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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

      setIsLoading(true);
      setError(null);

      try {
        // Get current user's department
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
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

        if (profileError || !profile?.department) {
          if (!isCancelled) {
            setIsLoading(false);
            setError('Could not determine user department');
          }
          return;
        }

        // Use the optimized service to get the UUID
        const result = await FlexUuidService.getFlexUuid(jobId, profile.department);

        if (!isCancelled) {
          setFlexUuid(result.uuid);
          setError(result.error);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching flex UUID:', error);
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
