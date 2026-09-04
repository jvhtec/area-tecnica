import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


import { queryKeys } from "@/lib/react-query";
export interface Venue {
  id: string;
  name: string;
  google_place_id: string | null;
  city: string;
  state_region: string | null;
  country: string;
  full_address: string | null;
  coordinates: { lat: number; lng: number } | null;
  capacity: number | null;
  created_at: string;
  updated_at: string;
}

export interface VenueMetadata {
  name: string;
  google_place_id?: string | null;
  city: string;
  state_region?: string | null;
  country: string;
  full_address?: string | null;
  coordinates?: { lat: number; lng: number } | null;
  capacity?: number | null;
}

export const useVenues = (searchTerm?: string) => {
  return useQuery({
    queryKey: queryKeys.scope('venues', searchTerm),
    queryFn: async () => {
      let query = supabase.from('venues').select('*').order('name');

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Venue[];
    },
  });
};

export const useUpsertVenue = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (venueData: VenueMetadata) => {
      // `upsert_venue` declares every argument as nullable, and the optional ones
      // DEFAULT NULL — so omitting them is equivalent to passing NULL. The generated
      // `types.ts` does not model argument nullability, hence the two casts below for
      // the arguments that have no default and must therefore be sent explicitly.
      const { data, error } = await supabase.rpc('upsert_venue', {
        p_name: venueData.name,
        p_google_place_id: (venueData.google_place_id || null) as string,
        p_city: venueData.city,
        p_state_region: (venueData.state_region || null) as string,
        p_country: venueData.country,
        p_full_address: venueData.full_address || undefined,
        p_coordinates: venueData.coordinates || undefined,
        p_capacity: venueData.capacity || undefined,
      });

      if (error) throw error;
      return data as string; // Returns venue_id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('venues') });
    },
    onError: (error) => {
      console.error('Error upserting venue:', error);
      toast.error('Failed to save venue information');
    },
  });
};
