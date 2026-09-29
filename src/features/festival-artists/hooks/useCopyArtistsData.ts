import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { trackError } from "@/lib/errorTracking";
import {
  fetchCopySourceFestivals,
  fetchFestivalArtistDates,
  fetchFestivalArtistsByIds,
  fetchFestivalArtistsOfDate,
  insertFestivalArtists,
  searchArtistsInOtherFestivals,
} from "../api";
import { buildCopiedArtistRows, type CopyArtistsOptions } from "../copyArtists";
import { festivalArtistKeys } from "../keys";

export const COPY_SEARCH_MIN_LENGTH = 2;
export const COPY_SEARCH_LIMIT = 50;

/** Toasts (and reports) a failed load once per failure. */
const useLoadErrorToast = (error: unknown, message: string, operation: string) => {
  useEffect(() => {
    if (!error) return;
    void trackError(error, { system: "festivals", operation });
    toast.error(message);
  }, [error, message, operation]);
};

interface UseCopyArtistsDataOptions {
  open: boolean;
  currentJobId: string;
  selectedFestival: string;
  selectedSourceDate: string;
  debouncedSearch: string;
}

/** Everything the copy-artists dialog reads: source festivals, their dates and artists, and name search. */
export function useCopyArtistsData({
  open,
  currentJobId,
  selectedFestival,
  selectedSourceDate,
  debouncedSearch,
}: UseCopyArtistsDataOptions) {
  const festivals = useQuery({
    queryKey: festivalArtistKeys.copyFestivals(currentJobId),
    queryFn: () => fetchCopySourceFestivals(currentJobId),
    enabled: open,
  });
  const dates = useQuery({
    queryKey: festivalArtistKeys.copyDates(selectedFestival),
    queryFn: () => fetchFestivalArtistDates(selectedFestival),
    enabled: open && !!selectedFestival,
  });
  const dayArtists = useQuery({
    queryKey: festivalArtistKeys.copyDayArtists(selectedFestival, selectedSourceDate),
    queryFn: () => fetchFestivalArtistsOfDate(selectedFestival, selectedSourceDate),
    enabled: open && !!selectedFestival && !!selectedSourceDate,
  });
  const search = useQuery({
    queryKey: festivalArtistKeys.copySearch(currentJobId, debouncedSearch),
    queryFn: () => searchArtistsInOtherFestivals(currentJobId, debouncedSearch, COPY_SEARCH_LIMIT),
    enabled: open && debouncedSearch.length >= COPY_SEARCH_MIN_LENGTH,
  });

  useLoadErrorToast(festivals.error, "Error al cargar festivales", "load-copy-source-festivals");
  useLoadErrorToast(dates.error, "Error al cargar fechas disponibles", "load-copy-source-dates");
  useLoadErrorToast(dayArtists.error, "Error al cargar artistas", "load-copy-source-artists");

  return {
    festivals: festivals.data ?? [],
    isLoadingFestivals: festivals.isLoading,
    availableDates: dates.data ?? [],
    isLoadingDates: dates.isFetching,
    dayArtists: dayArtists.data ?? [],
    isLoadingDayArtists: dayArtists.isFetching,
    searchResults: search.data ?? [],
    isSearching: search.isFetching,
  };
}

/** Copies the chosen artists onto `targetDate` of `targetJobId` with the given options. */
export function useCopyArtists({
  targetJobId,
  targetDate,
}: {
  targetJobId: string;
  targetDate: string;
}) {
  return useMutation({
    mutationFn: async ({ artistIds, options }: { artistIds: string[]; options: CopyArtistsOptions }) => {
      const sources = await fetchFestivalArtistsByIds(artistIds);
      await insertFestivalArtists(
        buildCopiedArtistRows(sources, options, { jobId: targetJobId, date: targetDate }),
      );
      return sources.length;
    },
  });
}
