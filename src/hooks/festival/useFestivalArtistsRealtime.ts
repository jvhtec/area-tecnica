
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useTableSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";

interface UseFestivalArtistsRealtimeParams {
  jobId: string;
  selectedDate: string;
}

export function useFestivalArtistsRealtime({ 
  jobId, 
  selectedDate 
}: UseFestivalArtistsRealtimeParams) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Set up real-time subscription for festival artists
  useTableSubscription('festival_artists', ['festival_artists', jobId, selectedDate], {
    event: '*',
    schema: 'public',
    filter: `job_id=eq.${jobId} AND date=eq.${selectedDate}`
  });

  const fetchArtists = useCallback(async () => {
    try {
      console.log(`Fetching artists for job: ${jobId}, date: ${selectedDate}`);
      
      const { data, error } = await supabase
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("name");

      if (error) throw error;
      
      return data || [];
    } catch (error: any) {
      console.error("Error fetching artists:", error);
      toast({
        title: "Error",
        description: "Could not load artists: " + error.message,
        variant: "destructive",
      });
      return [];
    }
  }, [jobId, selectedDate, toast]);

  const { 
    data: artists = [], 
    isLoading, 
    refetch 
  } = useQuery({
    queryKey: ['festival_artists', jobId, selectedDate],
    queryFn: fetchArtists,
    enabled: !!jobId && !!selectedDate,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    artists,
    isLoading,
    isRefreshing,
    refetch: handleRefresh
  };
}
