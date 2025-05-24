
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export const useArtistsQuery = (jobId: string | undefined, selectedDate: string, dayStartTime: string = "07:00") => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query for fetching artists
  const {
    data: artists = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['festival-artists', jobId, selectedDate],
    queryFn: async () => {
      if (!jobId || !selectedDate) return [];

      const { data, error } = await supabase
        .from("festival_artists")
        .select("*")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("show_start", { ascending: true });

      if (error) throw error;

      // Process artists for after midnight logic
      const processedArtists = data?.map(artist => {
        if (artist.isaftermidnight !== undefined) {
          return artist;
        }
        
        if (!artist.show_start) return artist;
        
        const [hours] = artist.show_start.split(':').map(Number);
        const [startHour] = dayStartTime.split(':').map(Number);
        const isAfterMidnight = hours < startHour;
        
        return {
          ...artist,
          isaftermidnight: isAfterMidnight
        };
      }) || [];

      return processedArtists;
    },
    enabled: !!jobId && !!selectedDate,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });

  // Mutation for deleting artists
  const deleteArtistMutation = useMutation({
    mutationFn: async (artistId: string) => {
      const { error } = await supabase
        .from("festival_artists")
        .delete()
        .eq("id", artistId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['festival-artists', jobId, selectedDate] });
      toast({
        title: "Success",
        description: "Artist deleted successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting artist:", error);
      toast({
        title: "Error",
        description: "Could not delete artist: " + error.message,
        variant: "destructive",
      });
    }
  });

  // Function to invalidate and refetch artists
  const invalidateArtists = () => {
    queryClient.invalidateQueries({ queryKey: ['festival-artists', jobId, selectedDate] });
  };

  return {
    artists,
    isLoading,
    error,
    refetch,
    deleteArtist: deleteArtistMutation.mutate,
    isDeletingArtist: deleteArtistMutation.isPending,
    invalidateArtists
  };
};
