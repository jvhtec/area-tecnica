
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface TourWeightDefault {
  id: string;
  tour_id: string;
  item_name: string;
  weight_kg: number;
  quantity: number;
  category?: string;
  department?: string;
  created_at: string;
  updated_at: string;
}

export const useTourWeightDefaults = (tourId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: weightDefaults = [], isLoading } = useQuery({
    queryKey: ["tour-weight-defaults", tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_weight_defaults")
        .select("*")
        .eq("tour_id", tourId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TourWeightDefault[];
    },
    enabled: !!tourId,
  });

  const createDefaultMutation = useMutation({
    mutationFn: async (weightDefault: Omit<TourWeightDefault, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("tour_weight_defaults")
        .insert(weightDefault)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-weight-defaults", tourId] });
      toast({
        title: "Success",
        description: "Weight default created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create weight default",
        variant: "destructive",
      });
    },
  });

  const updateDefaultMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TourWeightDefault> & { id: string }) => {
      const { data, error } = await supabase
        .from("tour_weight_defaults")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-weight-defaults", tourId] });
      toast({
        title: "Success",
        description: "Weight default updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update weight default",
        variant: "destructive",
      });
    },
  });

  const deleteDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tour_weight_defaults")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-weight-defaults", tourId] });
      toast({
        title: "Success",
        description: "Weight default deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete weight default",
        variant: "destructive",
      });
    },
  });

  return {
    weightDefaults,
    isLoading,
    createDefault: createDefaultMutation.mutate,
    updateDefault: updateDefaultMutation.mutate,
    deleteDefault: deleteDefaultMutation.mutate,
    isCreating: createDefaultMutation.isPending,
    isUpdating: updateDefaultMutation.isPending,
    isDeleting: deleteDefaultMutation.isPending,
  };
};
