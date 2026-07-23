import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dataLayerClient } from "@/services/dataLayerClient";
import { queryKeys } from "@/lib/react-query";
import type { TechnicalDepartment } from "@/features/technical-tools/power/types";
import type { ConsumosComponent, ConsumosDepartmentConfig, FixtureType } from "./config";
import type { CustomPowerComponentInput } from "./useCustomPowerComponents";

type ConsumosComponentRow = {
  id: string;
  name: string;
  watts: number | string;
  fixture_type: string | null;
  legacy_code: number | null;
};

type ConsumosComponentsDatabase = {
  public: {
    Tables: {
      consumos_components: {
        Row: ConsumosComponentRow & { department: string };
        Insert: {
          id?: string;
          department: string;
          name: string;
          watts: number;
          fixture_type?: string | null;
          legacy_code?: number | null;
        };
        Update: {
          department?: string;
          name?: string;
          watts?: number;
          fixture_type?: string | null;
          legacy_code?: number | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const consumosComponentsQueryKey = (department: TechnicalDepartment) =>
  queryKeys.scope("consumos-components", department);

// consumos_components is not in the generated Supabase types yet; the cast can
// be dropped once types.ts is regenerated.
const componentsTable = () =>
  (
    dataLayerClient as unknown as SupabaseClient<ConsumosComponentsDatabase>
  ).from("consumos_components");

const mapRowToComponent = (row: ConsumosComponentRow): ConsumosComponent => ({
  // Seeded rows keep the numeric ids the frontend hardcoded before, so saved
  // table rows (componentId in table_data) keep resolving. New rows use uuid.
  id: row.legacy_code ?? row.id,
  name: row.name,
  watts: Number(row.watts),
  fixtureType: (row.fixture_type as FixtureType) ?? undefined,
});

/**
 * Department component catalog, backend-driven (consumos_components table)
 * with the bundled list as fallback while loading, on error, or when the
 * table has not been seeded yet.
 */
export const useConsumosComponents = (config: ConsumosDepartmentConfig) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: consumosComponentsQueryKey(config.department),
    queryFn: async () => {
      const { data, error } = await componentsTable()
        .select("id, name, watts, fixture_type, legacy_code")
        .eq("department", config.department)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as ConsumosComponentRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const catalogComponents: ConsumosComponent[] = useMemo(() => {
    if (!query.data || query.data.length === 0) return config.components;
    return query.data.map(mapRowToComponent);
  }, [query.data, config.components]);

  const createComponentMutation = useMutation({
    mutationFn: async (input: CustomPowerComponentInput): Promise<ConsumosComponent> => {
      const { data, error } = await componentsTable()
        .insert({
          department: config.department,
          name: input.name.trim(),
          watts: input.watts,
          fixture_type: input.fixtureType ?? null,
        })
        .select("id, name, watts, fixture_type, legacy_code")
        .single();
      if (error) throw error;
      return mapRowToComponent(data as ConsumosComponentRow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: consumosComponentsQueryKey(config.department),
      });
    },
  });

  return {
    catalogComponents,
    isCatalogLoading: query.isLoading,
    createComponent: createComponentMutation.mutateAsync,
    isCreatingComponent: createComponentMutation.isPending,
  };
};
