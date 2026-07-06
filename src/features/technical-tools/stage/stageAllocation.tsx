import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  buildFallbackStageOptions,
  buildFestivalStageOptions,
} from "@/features/festival-management/selectors";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";
export {
  appendTechnicalStageToFilename,
  formatTechnicalStageLabel,
  getTechnicalStageKey,
  getTechnicalStageStorageScope,
  isSameTechnicalStage,
  type TechnicalStage,
} from "@/features/technical-tools/stage/stageUtils";

type FestivalStageRow = {
  number?: number | null;
  name?: string | null;
};

export const useJobTechnicalStages = ({
  enabled = true,
  jobId,
}: {
  enabled?: boolean;
  jobId: string;
}) =>
  useQuery<TechnicalStage[]>({
    queryKey: queryKeys.scope("technical-tool-stages", jobId),
    enabled: enabled && Boolean(jobId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: gearSetups, error: gearError } = await dataLayerClient
        .from("festival_gear_setups")
        .select("max_stages")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (gearError) throw gearError;

      const fallbackMaxStages = Math.max(
        Number(gearSetups?.[0]?.max_stages || 1),
        1
      );

      const { data: stageRows, error: stageError } = await dataLayerClient
        .from("festival_stages")
        .select("number, name")
        .eq("job_id", jobId)
        .order("number", { ascending: true });

      if (stageError) throw stageError;

      const hasConfiguredStages = (stageRows || []).length > 0;
      const { maxStages, options } = hasConfiguredStages
        ? buildFestivalStageOptions(stageRows as FestivalStageRow[], fallbackMaxStages)
        : {
            maxStages: fallbackMaxStages,
            options: buildFallbackStageOptions(fallbackMaxStages),
          };

      return maxStages > 1 ? options : [];
    },
  });

export const useSelectedTechnicalStage = ({
  enabled = true,
  jobId,
}: {
  enabled?: boolean;
  jobId: string;
}) => {
  const { data: stages = [], isLoading } = useJobTechnicalStages({ enabled, jobId });
  const [selectedStageNumber, setSelectedStageNumber] = useState<number | null>(null);

  useEffect(() => {
    if (stages.length === 0) {
      setSelectedStageNumber(null);
      return;
    }

    setSelectedStageNumber((current) =>
      current && stages.some((stage) => stage.number === current)
        ? current
        : stages[0].number
    );
  }, [stages]);

  const selectedStage = useMemo(
    () => stages.find((stage) => stage.number === selectedStageNumber) || null,
    [selectedStageNumber, stages]
  );

  return {
    hasMultipleStages: stages.length > 1,
    isLoadingStages: isLoading,
    selectedStage,
    selectedStageNumber,
    setSelectedStageNumber,
    stages,
  };
};

export const TechnicalStageSelector = ({
  disabled = false,
  label = "Stage",
  onChange,
  selectedStageNumber,
  stages,
}: {
  disabled?: boolean;
  label?: string;
  onChange: (stageNumber: number) => void;
  selectedStageNumber: number | null;
  stages: TechnicalStage[];
}) => {
  if (stages.length <= 1) return null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        disabled={disabled}
        value={selectedStageNumber ? String(selectedStageNumber) : undefined}
        onValueChange={(value) => onChange(Number(value))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select stage" />
        </SelectTrigger>
        <SelectContent>
          {stages.map((stage) => (
            <SelectItem key={stage.number} value={String(stage.number)}>
              {stage.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
