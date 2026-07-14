
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";


import { queryKeys } from "@/lib/react-query";
import { scheduleTourDateDefaultDocumentSync } from "@/utils/tourDateDocumentSync";
export interface TourDatePowerOverride {
  id: string;
  tour_date_id: string;
  default_table_id?: string;
  table_name: string;
  pdu_type: string;
  custom_pdu_type?: string;
  position?: string | null;
  custom_position?: string | null;
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

  // Job-based override mode mounts this hook without a tourDateId, so the
  // mutated row's tour_date_id takes priority over the hook argument.
  const resolveTargetTourDateId = (affectedTourDateId?: string | null) =>
    affectedTourDateId || tourDateId || null;

  // The auto-generated per-date power/weight PDFs (tour_documents) embed
  // override data, so every override mutation must regenerate them or job
  // cards keep serving a stale document.
  const refreshDefaultDocuments = (affectedTourDateId?: string | null) => {
    const targetTourDateId = resolveTargetTourDateId(affectedTourDateId);
    if (!targetTourDateId) return;

    scheduleTourDateDefaultDocumentSync({
      tourDateId: targetTourDateId,
      onComplete: ({ tourId, result }) => {
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-documents", tourId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("jobcard-tour-documents") });
        queryClient.invalidateQueries({ queryKey: queryKeys.scope("tour-documents-for-job") });

        if (result.errors.length > 0) {
          toast({
            title: "Aviso de sincronización de PDF",
            description: `${result.errors.length} documento(s) automáticos no se pudieron actualizar.`,
            variant: "destructive",
          });
        }
      },
      onError: () => {
        toast({
          title: "Aviso de sincronización de PDF",
          description: "No se pudieron actualizar los PDF automáticos de la fecha de gira.",
          variant: "destructive",
        });
      },
    });
  };

  const invalidateOverrideQueries = (table: 'power' | 'weight', affectedTourDateId?: string | null) => {
    const targetTourDateId = resolveTargetTourDateId(affectedTourDateId);
    if (!targetTourDateId) return;
    const scope = table === 'power' ? "tour-date-power-overrides" : "tour-date-weight-overrides";
    queryClient.invalidateQueries({ queryKey: queryKeys.scope(scope, targetTourDateId) });
  };

  // Fetch power overrides
  const { data: powerOverrides = [], isLoading: powerLoading } = useQuery({
    queryKey: queryKeys.scope("tour-date-power-overrides", tourDateId),
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
    queryKey: queryKeys.scope("tour-date-weight-overrides", tourDateId),
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
    onSuccess: (data) => {
      invalidateOverrideQueries('power', data?.tour_date_id);
      refreshDefaultDocuments(data?.tour_date_id);
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
    onSuccess: (data) => {
      invalidateOverrideQueries('weight', data?.tour_date_id);
      refreshDefaultDocuments(data?.tour_date_id);
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
    onSuccess: (result) => {
      invalidateOverrideQueries('power', result?.tour_date_id);
      refreshDefaultDocuments(result?.tour_date_id);
    },
  });

  // Delete override
  const deleteOverrideMutation = useMutation({
    mutationFn: async ({ id, table }: { id: string; table: 'power' | 'weight' }) => {
      const tableName = table === 'power' ? 'tour_date_power_overrides' : 'tour_date_weight_overrides';
      const { data, error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id)
        .select("tour_date_id");

      if (error) throw error;
      return { id, table, tourDateId: data?.[0]?.tour_date_id ?? null };
    },
    onSuccess: ({ table, tourDateId: affectedTourDateId }) => {
      invalidateOverrideQueries(table, affectedTourDateId);
      refreshDefaultDocuments(affectedTourDateId);
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
