import { useQuery } from "@tanstack/react-query";
import {
  fetchFestivalGearSetups,
  fetchFestivalLogoUrl,
  fetchFestivalStageNames,
  type FestivalGearSetups,
} from "../api";
import { festivalArtistKeys } from "../keys";

const NO_STAGE_NAMES: Record<number, string> = {};

/** Stage names of a festival. Failures surface through `error`; the UI falls back to numbers. */
export const useFestivalStageNames = (jobId: string | undefined) => {
  const query = useQuery({
    queryKey: festivalArtistKeys.stageNames(jobId),
    networkMode: "always",
    queryFn: () => fetchFestivalStageNames(jobId!),
    enabled: !!jobId,
  });
  return { stageNames: query.data ?? NO_STAGE_NAMES, error: query.error };
};

/** Logo used on the artist PDFs (festival logo, else the tour's). `null` when there is none. */
export const useFestivalLogoUrl = (jobId: string | undefined) => {
  const query = useQuery({
    queryKey: festivalArtistKeys.logo(jobId),
    queryFn: () => fetchFestivalLogoUrl(jobId!),
    enabled: !!jobId,
  });
  return { logoUrl: query.data ?? "", error: query.error };
};

const NO_GEAR_SETUPS: FestivalGearSetups = { festivalGearSetup: null, stageGearSetups: {} };

/** Festival + per-stage gear setups. Failures surface through `error`; comparisons are then skipped. */
export const useFestivalGearSetups = (jobId: string | undefined) => {
  const query = useQuery({
    queryKey: festivalArtistKeys.gearSetups(jobId),
    queryFn: () => fetchFestivalGearSetups(jobId!),
    enabled: !!jobId,
    // Gear is edited on another page; the comparison must not show a stale setup.
    staleTime: 0,
    refetchOnMount: "always",
  });
  return { ...(query.data ?? NO_GEAR_SETUPS), error: query.error };
};
