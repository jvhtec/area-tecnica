import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import { buildFestivalStageOptions } from "@/features/festival-management/selectors";
import {
  fetchCustomStageNumbers,
  fetchFestivalJobTitle,
  fetchFestivalMaxStages,
  fetchFestivalStageRows,
  renameFestivalStage,
  setFestivalMaxStages,
} from "../api";
import { festivalGearKeys } from "../keys";

const NO_CUSTOM_STAGES: number[] = [];

/**
 * Stages of a festival for the gear page: their names, how many there are, which ones have their
 * own gear override, and the actions to add or rename one. Stages that were never named simply
 * read as "Stage n" — nothing is written on read.
 */
export function useFestivalStages(jobId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const title = useQuery({
    queryKey: festivalGearKeys.jobTitle(jobId),
    queryFn: () => fetchFestivalJobTitle(jobId!),
    enabled: !!jobId,
  });
  const rows = useQuery({
    queryKey: festivalGearKeys.stages(jobId),
    queryFn: () => fetchFestivalStageRows(jobId!),
    enabled: !!jobId,
  });
  const configuredMax = useQuery({
    queryKey: festivalGearKeys.maxStages(jobId),
    queryFn: () => fetchFestivalMaxStages(jobId!),
    enabled: !!jobId,
  });
  const customStages = useQuery({
    queryKey: festivalGearKeys.customStages(jobId),
    queryFn: () => fetchCustomStageNumbers(jobId!),
    enabled: !!jobId,
  });

  const loadError = title.error ?? rows.error ?? configuredMax.error;
  useEffect(() => {
    if (!loadError) return;
    void trackError(loadError, { system: "festivals", operation: "load-festival-stages", jobId });
    toast({
      title: "Error",
      description: "No se pudo cargar la configuración de equipo del festival",
      variant: "destructive",
    });
  }, [loadError, jobId, toast]);

  const { maxStages, options } = buildFestivalStageOptions(rows.data, configuredMax.data ?? 1);

  const invalidateStages = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: festivalGearKeys.stages(jobId) }),
      queryClient.invalidateQueries({ queryKey: festivalGearKeys.all(jobId) }),
    ]);

  const addStage = useMutation({
    mutationFn: () => setFestivalMaxStages(jobId!, maxStages + 1),
    onSuccess: async (count) => {
      await invalidateStages();
      toast({ title: "Éxito", description: `Actualizado a ${count} escenarios` });
    },
    onError: (error) => {
      void trackError(error, { system: "festivals", operation: "set-festival-max-stages", jobId });
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración de escenarios",
        variant: "destructive",
      });
    },
  });

  const renameStage = useMutation({
    mutationFn: ({ stageNumber, name }: { stageNumber: number; name: string }) =>
      renameFestivalStage(jobId!, stageNumber, name),
    onSuccess: async () => {
      await invalidateStages();
      toast({ title: "Éxito", description: "Nombre del escenario actualizado" });
    },
    onError: (error) => {
      void trackError(error, { system: "festivals", operation: "rename-festival-stage", jobId });
      toast({
        title: "Error",
        description: "No se pudo actualizar el nombre del escenario",
        variant: "destructive",
      });
    },
  });

  return {
    jobTitle: title.data ?? "",
    isLoading: title.isLoading || rows.isLoading || configuredMax.isLoading,
    stages: options,
    maxStages,
    customStageNumbers: customStages.data ?? NO_CUSTOM_STAGES,
    addStage: () => addStage.mutate(),
    isAddingStage: addStage.isPending,
    renameStage: (stageNumber: number, name: string) => renameStage.mutateAsync({ stageNumber, name }),
  };
}
