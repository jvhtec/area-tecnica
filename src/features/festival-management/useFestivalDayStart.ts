import { useQuery } from "@tanstack/react-query";

import { normalizeFestivalDayStartTime } from "@/features/festival-management/dayStart";
import { fetchFestivalSettings } from "@/features/festival-management/queries";
import { queryKeys } from "@/lib/react-query";

export const useFestivalDayStart = (jobId: string | undefined) => {
  const query = useQuery({
    queryKey: queryKeys.scope("festival-settings", jobId),
    networkMode: "always",
    queryFn: () => fetchFestivalSettings(jobId!),
    enabled: Boolean(jobId),
  });

  return {
    ...query,
    dayStartTime: query.isSuccess
      ? normalizeFestivalDayStartTime(query.data?.day_start_time)
      : undefined,
    isDayStartReady: query.isSuccess,
  };
};
