import { useQuery } from "@tanstack/react-query";
import type { CombinedGearSetup } from "@/types/festival";
import { fetchCombinedGearSetup } from "../api";
import { festivalGearKeys } from "../keys";

/**
 * The festival-wide gear setup plus one stage's override, used by the artist editors to show
 * what the festival provides. `selectedDate` is kept for the existing call sites: a gear setup
 * is per festival, not per date, so it does not affect the result.
 */
export const useCombinedGearSetup = (
  jobId: string,
  _selectedDate: string,
  stageNumber: number,
): {
  combinedSetup: CombinedGearSetup | null;
  isLoading: boolean;
  error: string | null;
} => {
  const query = useQuery({
    queryKey: festivalGearKeys.combined(jobId, stageNumber),
    queryFn: () => fetchCombinedGearSetup(jobId, stageNumber),
    enabled: !!jobId,
  });

  return {
    combinedSetup: query.data
      ? { globalSetup: query.data.globalSetup, stageSetup: query.data.stageSetup }
      : null,
    isLoading: query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : String(query.error)) : null,
  };
};
