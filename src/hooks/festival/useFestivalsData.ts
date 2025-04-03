
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useEnhancedQuery } from "../useEnhancedQuery";
import { toast } from "sonner";

export function useFestivalsData() {
  const fetchFestivals = useCallback(async () => {
    console.log("Fetching festival jobs...");
    
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select(`
          *,
          location:locations(name),
          job_departments!inner(department),
          job_assignments(
            technician_id,
            sound_role,
            lights_role,
            video_role,
            profiles(
              first_name,
              last_name
            )
          ),
          job_documents(*),
          tour_date:tour_dates(*)
        `)
        .eq("job_type", "festival")
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error fetching festival jobs:", error);
        throw error;
      }

      console.log(`Successfully fetched ${data?.length || 0} festivals`);
      return data || [];
    } catch (error: any) {
      console.error("Error in fetchFestivals:", error);
      toast.error(`Failed to load festivals: ${error.message}`);
      throw error;
    }
  }, []);

  const { 
    data: festivals = [], 
    isLoading, 
    isError, 
    error,
    isRefreshing,
    manualRefresh,
    connectionStatus
  } = useEnhancedQuery(
    ["festivals"],
    fetchFestivals,
    "jobs",
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    }
  );

  return {
    festivals,
    isLoading,
    isError,
    error,
    isRefreshing,
    refetch: manualRefresh,
    connectionStatus
  };
}
