
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export interface TourDatePowerOverride {
  id: string;
  tour_date_id: string;
  default_table_id?: string;
  table_name: string;
  pdu_type: string;
  custom_pdu_type?: string;
  total_watts: number;
  current_per_phase: number;
  includes_hoist: boolean;
  department?: string;
  override_data?: any;
  created_at: string;
  updated_at: string;
}

export interface TourDateWeightOverride {
  id: string;
  tour_date_id: string;
  default_table_id?: string;
  item_name: string;
  weight_kg: number;
  quantity: number;
  department?: string;
  category?: string;
  override_data?: any;
  created_at: string;
  updated_at: string;
}

export const useTourDateOverrides = (tourDateId: string, type: 'power' | 'weight') => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch power overrides
  const { data: powerOverrides = [], isLoading: powerLoading } = useQuery({
    queryKey: ["tour-date-power-overrides", tourDateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_date_power_overrides")
        .select("*")
        .eq("tour_date_id", tourDateId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TourDatePowerOverride[];
    },
    enabled: !!tourDateId && type === 'power',
  });

  // Fetch weight overrides
  const { data: weightOverrides = [], isLoading: weightLoading } = useQuery({
    queryKey: ["tour-date-weight-overrides", tourDateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_date_weight_overrides")
        .select("*")
        .eq("tour_date_id", tourDateId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TourDateWeightOverride[];
    },
    enabled: !!tourDateId && type === 'weight',
  });

  // Create power override
  const createPowerOverrideMutation = useMutation({
    mutationFn: async (override: Omit<TourDatePowerOverride, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("tour_date_power_overrides")
        .insert(override)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-date-power-overrides", tourDateId] });
    },
  });

  // Create weight override
  const createWeightOverrideMutation = useMutation({
    mutationFn: async (override: Omit<TourDateWeightOverride, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("tour_date_weight_overrides")
        .insert(override)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-date-weight-overrides", tourDateId] });
    },
  });

  // Update power override
  const updatePowerOverrideMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TourDatePowerOverride> }) => {
      const { data: result, error } = await supabase
        .from("tour_date_power_overrides")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-date-power-overrides", tourDateId] });
    },
  });

  // Delete override
  const deleteOverrideMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string; table: 'power' | 'weight' }) => {
      const tableName = table === 'power' ? 'tour_date_power_overrides' : 'tour_date_weight_overrides';
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { id, table };
    },
    onSuccess: ({ table }) => {
      if (table === 'power') {
        queryClient.invalidateQueries({ queryKey: ["tour-date-power-overrides", tourDateId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["tour-date-weight-overrides", tourDateId] });
      }
    },
  });

  return {
    powerOverrides,
    weightOverrides,
    isLoading: powerLoading || weightLoading,
    createPowerOverride: createPowerOverrideMutation.mutateAsync,
    createWeightOverride: createWeightOverrideMutation.mutateAsync,
    updatePowerOverride: updatePowerOverrideMutation.mutateAsync,
    deleteOverride: deleteOverrideMutation.mutateAsync,
    isCreatingOverride: createPowerOverrideMutation.isPending || createWeightOverrideMutation.isPending,
    isDeletingOverride: deleteOverrideMutation.isPending,
  };
};
