
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface TourPowerDefault {
  id: string;
  tour_id: string;
  table_name: string;
  pdu_type: string;
  custom_pdu_type?: string;
  total_watts: number;
  current_per_phase: number;
  includes_hoist: boolean;
  department?: string;
  created_at: string;
  updated_at: string;
}

export const useTourPowerDefaults = (tourId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: powerDefaults = [], isLoading } = useQuery({
    queryKey: ["tour-power-defaults", tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_power_defaults")
        .select("*")
        .eq("tour_id", tourId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TourPowerDefault[];
    },
    enabled: !!tourId,
  });

  const createDefaultMutation = useMutation({
    mutationFn: async (powerDefault: Omit<TourPowerDefault, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("tour_power_defaults")
        .insert(powerDefault)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-power-defaults", tourId] });
      toast({
        title: "Success",
        description: "Power default created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create power default",
        variant: "destructive",
      });
    },
  });

  const updateDefaultMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TourPowerDefault> & { id: string }) => {
      const { data, error } = await supabase
        .from("tour_power_defaults")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-power-defaults", tourId] });
      toast({
        title: "Success",
        description: "Power default updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update power default",
        variant: "destructive",
      });
    },
  });

  const deleteDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tour_power_defaults")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-power-defaults", tourId] });
      toast({
        title: "Success",
        description: "Power default deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete power default",
        variant: "destructive",
      });
    },
  });

  return {
    powerDefaults,
    isLoading,
    createDefault: createDefaultMutation.mutate,
    updateDefault: updateDefaultMutation.mutate,
    deleteDefault: deleteDefaultMutation.mutate,
    isCreating: createDefaultMutation.isPending,
    isUpdating: updateDefaultMutation.isPending,
    isDeleting: deleteDefaultMutation.isPending,
  };
};
