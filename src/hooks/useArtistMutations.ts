import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

import { queryKeys } from "@/lib/react-query";

type FestivalArtistInsert = Database["public"]["Tables"]["festival_artists"]["Insert"];
type FestivalArtistUpdate = Database["public"]["Tables"]["festival_artists"]["Update"];
type FestivalArtistUpdatePayload = FestivalArtistUpdate & { id: string };
type ArtistTimeField = "show_start" | "show_end" | "soundcheck_start" | "soundcheck_end";
type ArtistTimePayload = (FestivalArtistInsert | FestivalArtistUpdate) &
  Partial<Record<ArtistTimeField, string | null>>;

const artistTimeFields: ArtistTimeField[] = ["show_start", "show_end", "soundcheck_start", "soundcheck_end"];

// Helper function to format artist time data
const formatArtistTimeData = <T extends ArtistTimePayload>(artistData: T): T => {
  const formattedData = { ...artistData };

  artistTimeFields.forEach(field => {
    if (formattedData[field] === '') {
      formattedData[field] = null;
    }
  });
  return formattedData;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
};

export const useArtistMutations = (jobId: string | undefined, selectedDate: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createArtistMutation = useMutation({
    mutationFn: async (artistData: FestivalArtistInsert) => {
      const dataToInsert = formatArtistTimeData({ ...artistData, job_id: jobId });
      const { data, error } = await supabase
        .from("festival_artists")
        .insert([dataToInsert])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('festival-artists', jobId, selectedDate) });
      toast({
        title: "Success",
        description: "Artist created successfully",
      });
    },
    onError: (error: unknown) => {
      console.error("Error creating artist:", error);
      toast({
        title: "Error",
        description: "Could not create artist: " + getErrorMessage(error),
        variant: "destructive",
      });
    }
  });

  const updateArtistMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: FestivalArtistUpdatePayload) => {
      const dataToUpdate = formatArtistTimeData(updateData);
      const { data, error } = await supabase
        .from("festival_artists")
        .update(dataToUpdate)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('festival-artists', jobId, selectedDate) });
      toast({
        title: "Success",
        description: "Artist updated successfully",
      });
    },
    onError: (error: unknown) => {
      console.error("Error updating artist:", error);
      toast({
        title: "Error",
        description: "Could not update artist: " + getErrorMessage(error),
        variant: "destructive",
      });
    }
  });

  return {
    createArtist: createArtistMutation.mutate,
    updateArtist: updateArtistMutation.mutate,
    isCreating: createArtistMutation.isPending,
    isUpdating: updateArtistMutation.isPending,
  };
};
