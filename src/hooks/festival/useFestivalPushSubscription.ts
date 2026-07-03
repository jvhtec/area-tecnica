import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";

export type FestivalPushStageOption = {
  number: number;
  label: string;
  assigned: boolean;
};

type FestivalPushSubscriptionRow = {
  id: string;
  user_id: string;
  job_id: string;
  enabled: boolean;
  stages: number[];
};

type SaveFestivalPushSubscriptionInput = {
  enabled: boolean;
  stages: number[];
};

const isManagementSubscriber = (role: string | null | undefined) =>
  role === "admin" || role === "management";

const normalizeStages = (stages: number[]) =>
  Array.from(new Set(stages.filter((stage) => Number.isInteger(stage) && stage > 0)))
    .sort((left, right) => left - right);

export const useFestivalPushSubscription = (jobId?: string) => {
  const { user, userRole } = useOptimizedAuth();
  const queryClient = useQueryClient();
  const canChooseAnyStage = isManagementSubscriber(userRole);

  const subscriptionKey = queryKeys.scope("festival-push-subscription", jobId, user?.id);
  const stagesKey = queryKeys.scope("festival-push-stages", jobId, user?.id, userRole);

  const subscriptionQuery = useQuery({
    queryKey: subscriptionKey,
    queryFn: async (): Promise<FestivalPushSubscriptionRow | null> => {
      if (!jobId || !user?.id) return null;

      const { data, error } = await dataLayerClient
        .from("festival_push_subscriptions")
        .select("id, user_id, job_id, enabled, stages")
        .eq("job_id", jobId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    },
    enabled: Boolean(jobId && user?.id),
  });

  const stagesQuery = useQuery({
    queryKey: stagesKey,
    queryFn: async (): Promise<FestivalPushStageOption[]> => {
      if (!jobId || !user?.id) return [];

      const [stageRows, gearRows, artistRows, shiftRows] = await Promise.all([
        dataLayerClient
          .from("festival_stages")
          .select("number, name")
          .eq("job_id", jobId),
        dataLayerClient
          .from("festival_gear_setups")
          .select("max_stages")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
          .limit(1),
        dataLayerClient
          .from("festival_artists")
          .select("stage")
          .eq("job_id", jobId)
          .not("stage", "is", null),
        dataLayerClient
          .from("festival_shifts")
          .select("id, stage")
          .eq("job_id", jobId),
      ]);

      if (stageRows.error) throw stageRows.error;
      if (gearRows.error) throw gearRows.error;
      if (artistRows.error) throw artistRows.error;
      if (shiftRows.error) throw shiftRows.error;

      const labels = new Map<number, string>();
      const stageNumbers = new Set<number>();

      for (const stage of stageRows.data ?? []) {
        if (typeof stage.number !== "number") continue;
        stageNumbers.add(stage.number);
        labels.set(stage.number, stage.name || `Escenario ${stage.number}`);
      }

      const maxStages = gearRows.data?.[0]?.max_stages ?? 0;
      for (let stage = 1; stage <= maxStages; stage += 1) {
        stageNumbers.add(stage);
      }

      for (const artist of artistRows.data ?? []) {
        if (typeof artist.stage === "number") stageNumbers.add(artist.stage);
      }

      const shiftIdToStage = new Map<string, number>();
      for (const shift of shiftRows.data ?? []) {
        if (shift.id && typeof shift.stage === "number") {
          shiftIdToStage.set(shift.id, shift.stage);
          stageNumbers.add(shift.stage);
        }
      }

      let assignedStages = new Set<number>();
      if (!canChooseAnyStage && shiftIdToStage.size > 0) {
        const { data, error } = await dataLayerClient
          .from("festival_shift_assignments")
          .select("shift_id")
          .eq("technician_id", user.id)
          .in("shift_id", Array.from(shiftIdToStage.keys()));

        if (error) throw error;

        assignedStages = new Set(
          (data ?? [])
            .map((assignment) => assignment.shift_id ? shiftIdToStage.get(assignment.shift_id) : undefined)
            .filter((stage): stage is number => typeof stage === "number"),
        );
      }

      const effectiveStages = canChooseAnyStage ? stageNumbers : assignedStages;

      return Array.from(effectiveStages)
        .sort((left, right) => left - right)
        .map((stageNumber) => ({
          number: stageNumber,
          label: labels.get(stageNumber) || `Escenario ${stageNumber}`,
          assigned: assignedStages.has(stageNumber),
        }));
    },
    enabled: Boolean(jobId && user?.id),
  });

  const selectableStageNumbers = useMemo(
    () => new Set((stagesQuery.data ?? []).map((stage) => stage.number)),
    [stagesQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: async ({ enabled, stages }: SaveFestivalPushSubscriptionInput) => {
      if (!jobId || !user?.id) throw new Error("No se pudo identificar el festival o el usuario.");

      const normalizedStages = normalizeStages(stages)
        .filter((stage) => selectableStageNumbers.has(stage));

      if (enabled && normalizedStages.length === 0) {
        throw new Error("Selecciona al menos un escenario para activar el feed.");
      }

      const { data, error } = await dataLayerClient
        .from("festival_push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            job_id: jobId,
            enabled,
            stages: normalizedStages,
          },
          { onConflict: "user_id,job_id" },
        )
        .select("id, user_id, job_id, enabled, stages")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (row) => {
      queryClient.setQueryData(subscriptionKey, row);
      await queryClient.invalidateQueries({ queryKey: subscriptionKey });
      toast.success(row.enabled ? "Feed de avisos activado" : "Feed de avisos pausado");
    },
    onError: (error) => {
      toast.error("No se pudo guardar el feed", {
        description: error instanceof Error ? error.message : "Inténtalo de nuevo.",
      });
    },
  });

  return {
    subscription: subscriptionQuery.data ?? null,
    isSubscribed: Boolean(subscriptionQuery.data?.enabled && (subscriptionQuery.data.stages ?? []).length > 0),
    selectedStages: normalizeStages(subscriptionQuery.data?.stages ?? []),
    stageOptions: stagesQuery.data ?? [],
    canChooseAnyStage,
    isLoading: subscriptionQuery.isLoading || stagesQuery.isLoading,
    isSaving: saveMutation.isPending,
    error: subscriptionQuery.error || stagesQuery.error,
    save: saveMutation.mutateAsync,
  };
};
