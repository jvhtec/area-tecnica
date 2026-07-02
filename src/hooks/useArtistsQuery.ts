
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  getFestivalSnapshot,
  getOfflineArtistsForDate,
  isBrowserOnline,
  queueFestivalChange,
} from "@/lib/offline";


import { queryKeys } from "@/lib/react-query";
export const useArtistsQuery = (jobId: string | undefined, selectedDate: string, dayStartTime: string = "07:00") => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOfflineData, setIsOfflineData] = useState(false);

  const fetchArtistsOnline = async () => {
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
  };

  // Query for fetching artists
  const {
    data: artists = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: queryKeys.scope('festival-artists', jobId, selectedDate),
    queryFn: async () => {
      if (!jobId || !selectedDate) return [];

      // Offline: serve the downloaded snapshot (with local edits applied)
      if (!isBrowserOnline()) {
        const offlineArtists = await getOfflineArtistsForDate(jobId, selectedDate, dayStartTime);
        if (offlineArtists) {
          setIsOfflineData(true);
          return offlineArtists;
        }
        throw new Error("Sin conexión y sin copia offline de este festival");
      }

      try {
        const onlineArtists = await fetchArtistsOnline();
        setIsOfflineData(false);
        return onlineArtists;
      } catch (fetchError) {
        // Network dropped mid-request: fall back to the offline copy if available
        const offlineArtists = await getOfflineArtistsForDate(jobId, selectedDate, dayStartTime);
        if (offlineArtists) {
          setIsOfflineData(true);
          return offlineArtists;
        }
        throw fetchError;
      }
    },
    enabled: !!jobId && !!selectedDate,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
    networkMode: "always", // run the queryFn even offline so the snapshot can be served
  });

  // Mutation for deleting artists
  const deleteArtistMutation = useMutation({
    networkMode: "always",
    mutationFn: async (artistId: string) => {
      // Offline: queue the deletion for manual sync
      if (!isBrowserOnline() && jobId) {
        const snapshot = await getFestivalSnapshot(jobId);
        if (!snapshot) {
          throw new Error("Sin conexión y sin copia offline de este festival");
        }
        const artist = snapshot.data.artists.find((row) => row.id === artistId);
        await queueFestivalChange({
          jobId,
          table: "festival_artists",
          operation: "delete",
          recordId: artistId,
          baseUpdatedAt: (artist?.updated_at as string | null) ?? null,
          label: (artist?.name as string | undefined) ?? undefined,
        });
        return { offline: true };
      }

      const { error } = await supabase
        .from("festival_artists")
        .delete()
        .eq("id", artistId);

      if (error) throw error;
      return { offline: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('festival-artists', jobId, selectedDate) });
      toast({
        title: result?.offline ? "Guardado offline" : "Success",
        description: result?.offline
          ? "Eliminación guardada. Sincroniza cuando vuelvas a tener conexión."
          : "Artist deleted successfully",
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
    queryClient.invalidateQueries({ queryKey: queryKeys.scope('festival-artists', jobId, selectedDate) });
  };

  return {
    artists,
    isLoading,
    error,
    refetch,
    deleteArtist: deleteArtistMutation.mutate,
    isDeletingArtist: deleteArtistMutation.isPending,
    invalidateArtists,
    isOfflineData
  };
};
