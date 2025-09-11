import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { logoCache } from "@/services/logoCache";
import { useMemo, useEffect } from "react";

export const useOptimizedTours = () => {
  const { data: tours = [], isLoading, error, refetch } = useQuery({
    queryKey: ["tours-optimized"],
    queryFn: async () => {
      console.log("Fetching tours with optimized query...");
      
      // Fetch tours with minimal data first for fast initial render
      const { data: toursData, error: toursError } = await supabase
        .from("tours")
        .select(`
          id,
          name,
          description,
          start_date,
          end_date,
          color,
          flex_folders_created,
          flex_main_folder_id
        `)
        .order("created_at", { ascending: false })
        .eq("deleted", false)
        .limit(50); // Limit initial load

      if (toursError) {
        console.error("Error fetching tours:", toursError);
        throw toursError;
      }

      console.log("Tours fetched successfully:", toursData?.length);
      return toursData || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: 1000,
  });

  // Separate query for tour dates to avoid blocking main tour render
  const { data: tourDates = {} } = useQuery({
    queryKey: ["tour-dates-batch", tours.map(t => t.id)],
    queryFn: async () => {
      if (tours.length === 0) return {};

      const { data: datesData, error: datesError } = await supabase
        .from("tour_dates")
        .select(`
          tour_id,
          id,
          date,
          start_date,
          end_date,
          date_type,
          location:locations (name)
        `)
        .in("tour_id", tours.map(t => t.id))
        .order("date", { ascending: true });

      if (datesError) {
        console.error("Error fetching tour dates:", datesError);
        return {};
      }

      // Group dates by tour_id
      const groupedDates: Record<string, any[]> = {};
      datesData?.forEach(date => {
        if (!groupedDates[date.tour_id]) {
          groupedDates[date.tour_id] = [];
        }
        groupedDates[date.tour_id].push(date);
      });

      return groupedDates;
    },
    enabled: tours.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Preload logos for all tours when tours data changes
  useEffect(() => {
    if (tours.length > 0) {
      const tourIds = tours.map(t => t.id);
      logoCache.preloadTourLogos(tourIds);
    }
  }, [tours]);

  // Combine tours with their dates
  const toursWithDates = useMemo(() => {
    return tours.map(tour => ({
      ...tour,
      tour_dates: tourDates[tour.id] || []
    }));
  }, [tours, tourDates]);

  // Filter tours efficiently
  const { activeTours, completedTours } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const active: any[] = [];
    const completed: any[] = [];

    toursWithDates.forEach(tour => {
      if (!tour.end_date) {
        active.push(tour);
        return;
      }
      
      const endDate = new Date(tour.end_date);
      endDate.setHours(0, 0, 0, 0);
      
      if (endDate >= today) {
        active.push(tour);
      } else {
        completed.push(tour);
      }
    });

    return { activeTours: active, completedTours: completed };
  }, [toursWithDates]);

  return {
    tours: toursWithDates,
    activeTours,
    completedTours,
    isLoading,
    error,
    refetch
  };
};