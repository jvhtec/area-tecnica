
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export type Festival = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  status?: string;
};

export function useFestival(festivalId: string) {
  const fetchFestival = async () => {
    if (!festivalId) {
      throw new Error('Festival ID is required');
    }

    try {
      const { data, error } = await supabase
        .from('festivals')
        .select('*')
        .eq('id', festivalId)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Festival not found');
      }

      return data as Festival;
    } catch (error: any) {
      console.error("Error fetching festival:", error);
      throw new Error(`Failed to fetch festival: ${error.message}`);
    }
  };

  const { 
    data: festival, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['festival', festivalId],
    queryFn: fetchFestival,
    enabled: !!festivalId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Subscribe to realtime changes for this festival
  useEffect(() => {
    if (!festivalId) return;

    const subscription = supabase
      .channel(`festival-${festivalId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'festivals',
        filter: `id=eq.${festivalId}`,
      }, (payload) => {
        console.log('Festival changed:', payload);
        refetch();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [festivalId, refetch]);

  return { festival, isLoading, isError, error, refetch };
}
