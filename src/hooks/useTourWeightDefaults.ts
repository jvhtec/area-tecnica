
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

  const { data: weightDefaults = [], isLoading, error } = useQuery({
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

  const createMutation = useMutation({
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

  const updateMutation = useMutation({
    mutationFn: async (data: TourWeightDefault) => {
      const { error } = await supabase
        .from('tour_weight_defaults')
        .update({
          item_name: data.item_name,
          weight_kg: data.weight_kg,
          quantity: data.quantity,
          category: data.category,
          department: data.department
        })
        .eq('id', data.id);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-weight-defaults', tourId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tour_weight_defaults')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-weight-defaults', tourId] });
    },
  });

  return {
    weightDefaults,
    isLoading,
    error,
    createDefault: createMutation.mutateAsync,
    updateDefault: updateMutation.mutateAsync,
    deleteDefault: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
