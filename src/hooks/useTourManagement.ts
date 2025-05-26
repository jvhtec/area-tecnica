
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Tour {
  id: string;
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  color: string;
  flex_folders_created: boolean;
}

interface TourDate {
  id: string;
  date: string;
  location?: {
    id: string;
    name: string;
  };
}

export function useTourManagement(tourId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch tour details
  const { data: tour, isLoading: tourLoading } = useQuery({
    queryKey: ['tour', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .eq('id', tourId)
        .eq('deleted', false)
        .single();

      if (error) throw error;
      return data as Tour;
    },
    enabled: !!tourId,
  });

  // Fetch tour dates
  const { data: tourDates, isLoading: datesLoading } = useQuery({
    queryKey: ['tour-dates', tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tour_dates')
        .select(`
          id,
          date,
          location:locations (
            id,
            name
          )
        `)
        .eq('tour_id', tourId)
        .order('date', { ascending: true });

      if (error) throw error;
      
      // Transform the data to match our TourDate interface
      const transformedData = data?.map(item => ({
        id: item.id,
        date: item.date,
        location: Array.isArray(item.location) ? item.location[0] : item.location
      })) || [];

      return transformedData as TourDate[];
    },
    enabled: !!tourId,
  });

  // Update tour
  const updateTour = async (updates: Partial<Tour>) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tours')
        .update(updates)
        .eq('id', tourId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['tour', tourId] });
      await queryClient.invalidateQueries({ queryKey: ['tours'] });
      
      toast.success('Tour updated successfully');
      return true;
    } catch (error: any) {
      console.error('Error updating tour:', error);
      toast.error('Failed to update tour');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete tour
  const deleteTour = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tours')
        .update({ deleted: true })
        .eq('id', tourId);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['tours'] });
      
      toast.success('Tour deleted successfully');
      return true;
    } catch (error: any) {
      console.error('Error deleting tour:', error);
      toast.error('Failed to delete tour');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Get tour statistics
  const getTourStats = () => {
    if (!tour || !tourDates) return null;

    const totalDates = tourDates.length;
    const locationsCount = new Set(
      tourDates
        .filter(date => date.location)
        .map(date => date.location!.id)
    ).size;

    const dateRange = tour.start_date && tour.end_date
      ? {
          start: new Date(tour.start_date),
          end: new Date(tour.end_date),
          duration: Math.ceil(
            (new Date(tour.end_date).getTime() - new Date(tour.start_date).getTime()) 
            / (1000 * 60 * 60 * 24)
          )
        }
      : null;

    return {
      totalDates,
      locationsCount,
      dateRange,
      hasFlexFolders: tour.flex_folders_created,
    };
  };

  return {
    tour,
    tourDates,
    isLoading: tourLoading || datesLoading || isLoading,
    updateTour,
    deleteTour,
    getTourStats,
    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['tour', tourId] });
      queryClient.invalidateQueries({ queryKey: ['tour-dates', tourId] });
    }
  };
}
