import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// Helper function to format artist time data
const formatArtistTimeData = (artistData: any) => {
  const formattedData = { ...artistData };
  const timeFields = ['show_start', 'show_end', 'soundcheck_start', 'soundcheck_end'];

  timeFields.forEach(field => {
    if (formattedData[field] === '') {
      formattedData[field] = null;
    }
  });
  return formattedData;
};

export const useArtistMutations = (jobId: string | undefined, selectedDate: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createArtistMutation = useMutation({
    mutationFn: async (artistData: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['festival-artists', jobId, selectedDate] });
      toast({
        title: "Success",
        description: "Artist created successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error creating artist:", error);
      toast({
        title: "Error",
        description: "Could not create artist: " + error.message,
        variant: "destructive",
      });
    }
  });

  const updateArtistMutation = useMutation({
    mutationFn: async ({ id, ...updateData }: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['festival-artists', jobId, selectedDate] });
      toast({
        title: "Success",
        description: "Artist updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error updating artist:", error);
      toast({
        title: "Error",
        description: "Could not update artist: " + error.message,
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
