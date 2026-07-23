
import type {
  PhaseMode,
  PowerTableRow,
} from "@/features/technical-tools/power/types";
import { useTourDateDefaultDocumentRefresh } from "@/hooks/useTourDateDefaultDocumentRefresh";
import type { Json } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/react-query";
import { supabase } from "@/lib/supabase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type TourDatePowerOverrideData = {
  rows?: PowerTableRow[];
  safetyMargin?: number;
  phaseMode?: PhaseMode;
  voltage?: number;
  pf?: number;
  calculation?: unknown;
};

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
  override_data?: TourDatePowerOverrideData;
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
  override_data?: unknown;
  created_at: string;
  updated_at: string;
}

export const useTourDateOverrides = (tourDateId: string, type: 'power' | 'weight') => {
  const queryClient = useQueryClient();
  const refreshDefaultDocuments = useTourDateDefaultDocumentRefresh(tourDateId);

  // Job-based override mode mounts this hook without a tourDateId, so the
  // mutated row's tour_date_id takes priority over the hook argument.
  const resolveTargetTourDateId = (affectedTourDateId?: string | null) =>
    affectedTourDateId || tourDateId || null;

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
      const payload = {
        ...override,
        override_data: override.override_data as Json | undefined,
      };
      const { data, error } = await supabase
        .from("tour_date_power_overrides")
        .insert(payload)
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
      const payload = {
        ...override,
        override_data: override.override_data as Json | undefined,
      };
      const { data, error } = await supabase
        .from("tour_date_weight_overrides")
        .insert(payload)
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
      const payload = {
        ...data,
        ...(data.override_data === undefined
          ? {}
          : { override_data: data.override_data as Json }),
      };
      const { data: result, error } = await supabase
        .from("tour_date_power_overrides")
        .update(payload)
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
