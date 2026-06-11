import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { queryKeys } from "@/lib/react-query";
import type { TechnicalDepartment } from "@/features/technical-tools/power/types";
import type { StageCopyableTable } from "./stageCopy";

export type QuickPresetTool = "consumos" | "pesos";

export type QuickPreset<T extends StageCopyableTable = StageCopyableTable> = {
  id: string;
  tool: QuickPresetTool;
  department: TechnicalDepartment;
  name: string;
  tables: T[];
  created_by: string | null;
  created_at: string;
};

export const quickPresetsQueryKey = (
  tool: QuickPresetTool,
  department: TechnicalDepartment,
) => queryKeys.scope("technical-tool-quick-presets", tool, department);

// technical_tool_quick_presets is not in the generated Supabase types yet; the
// cast can be dropped once types.ts is regenerated.
const presetsTable = () =>
  (dataLayerClient as unknown as { from: (table: string) => any }).from(
    "technical_tool_quick_presets",
  );

/**
 * Named table-set snapshots ("quick presets") shared across jobs and stages
 * for a tool/department, stored in the backend so they follow the user across
 * devices.
 */
export const useQuickPresets = <T extends StageCopyableTable>(
  tool: QuickPresetTool,
  department: TechnicalDepartment,
) => {
  const queryClient = useQueryClient();
  const queryKey = quickPresetsQueryKey(tool, department);

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<QuickPreset<T>[]> => {
      const { data, error } = await presetsTable()
        .select("id, tool, department, name, tables, created_by, created_at")
        .eq("tool", tool)
        .eq("department", department)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((row: QuickPreset<T>) => ({
        ...row,
        tables: Array.isArray(row.tables) ? row.tables : [],
      }));
    },
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ name, tables }: { name: string; tables: T[] }) => {
      const { data, error } = await presetsTable()
        .insert({ tool, department, name: name.trim(), tables })
        .select("id, name")
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const { error } = await presetsTable().delete().eq("id", presetId);
      if (error) throw error;
      return presetId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    presets: query.data ?? [],
    isLoadingPresets: query.isLoading,
    savePreset: saveMutation.mutateAsync,
    isSavingPreset: saveMutation.isPending,
    deletePreset: deleteMutation.mutateAsync,
    isDeletingPreset: deleteMutation.isPending,
  };
};
