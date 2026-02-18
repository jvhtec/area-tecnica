
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
        .select(`
          *,
          festival_artist_form_submissions!left (
            id,
            status
          )
        `)
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .order("show_start", { ascending: true });

      if (error) throw error;

      // Process artists for after midnight logic
      const processedArtists = data?.map((artist) => {
        const artistWithSubmissions = artist as typeof artist & {
          festival_artist_form_submissions?: Array<{ status?: string | null }> | null;
          artist_submitted?: boolean;
        };
        const submissions = artistWithSubmissions.festival_artist_form_submissions;
        const artistSubmitted = Array.isArray(submissions)
          ? submissions.some((submission) => submission?.status === "submitted")
          : false;

        const cleanedArtist = {
          ...artist,
          artist_submitted: artistSubmitted,
        };

        if (artist.isaftermidnight !== undefined) {
          return cleanedArtist;
        }
        
        if (!artist.show_start) return cleanedArtist;
        
        const [hours] = artist.show_start.split(':').map(Number);
        const [startHour] = dayStartTime.split(':').map(Number);
        const isAfterMidnight = hours < startHour;
        
        return {
          ...cleanedArtist,
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
