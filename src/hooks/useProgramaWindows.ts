import { useQuery } from "@tanstack/react-query";

import { dataLayerClient } from "@/services/dataLayerClient";
import type { ProgramDay } from "@/types/hoja-de-ruta";
import {
  deriveProgramaWindow,
  programaDateKey,
  type ProgramaWindow,
} from "@/utils/programaWindows";

/**
 * Authoritative day windows for the mobile agenda, read from each job's hoja
 * de ruta programa (`hoja_de_ruta.program_schedule_json`). Jobs without a
 * programa for the viewed day are simply absent from the map — callers fall
 * back to the job's own (often preliminary) start/end times.
 */
export function useProgramaWindows(
  jobIds: string[],
  selectedDate: Date,
): Record<string, ProgramaWindow> {
  const dateKey = programaDateKey(selectedDate);
  const sortedIds = [...jobIds].sort();

  const { data } = useQuery({
    queryKey: ["programa-windows", dateKey, sortedIds],
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: rows, error } = await dataLayerClient
        .from("hoja_de_ruta")
        .select("job_id, program_schedule_json")
        .in("job_id", sortedIds)
        .not("program_schedule_json", "is", null);

      if (error) throw error;

      const windows: Record<string, ProgramaWindow> = {};
      for (const row of rows ?? []) {
        const window = deriveProgramaWindow(
          row.program_schedule_json as unknown as ProgramDay[] | null,
          dateKey,
        );
        if (window) windows[row.job_id as string] = window;
      }
      return windows;
    },
  });

  return data ?? {};
}
