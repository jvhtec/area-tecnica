import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { queryKeys } from "@/lib/react-query";

export interface TourDate {
  id: string;
  tour: {
    id: string;
    name: string;
  };
}

export interface JobSelection {
  id: string;
  title: string;
  tour_date_id: string | null;
  tour_date: TourDate | null;
  start_time: string;
  end_time: string;
}

type JobSelectionRow = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  tour_date_id: string | null;
  tour_date?: Array<{
    id: string;
    tour?: Array<{ id: string; name: string }>;
  }> | null;
};

const mapJob = (job: JobSelectionRow): JobSelection => ({
  id: job.id,
  title: job.title,
  start_time: job.start_time,
  end_time: job.end_time,
  tour_date_id: job.tour_date_id,
  tour_date: job.tour_date?.[0]
    ? {
        id: job.tour_date[0].id,
        tour: {
          id: job.tour_date[0].tour?.[0]?.id || "",
          name: job.tour_date[0].tour?.[0]?.name || "",
        },
      }
    : null,
});

const JOB_SELECTION_COLUMNS = `
  id,
  title,
  start_time,
  end_time,
  tour_date_id,
  job_type,
  status,
  tour_date:tour_dates!tour_date_id (
    id,
    tour:tours (
      id,
      name
    )
  )
`;

export const useJobSelection = (includeJobId?: string) =>
  useQuery({
    queryKey: queryKeys.scope("jobs-for-selection", includeJobId || "active"),
    queryFn: async () => {
      const activeJobCutoff = new Date().toISOString();

      const { data: activeJobs, error } = await supabase
        .from("jobs")
        .select(JOB_SELECTION_COLUMNS)
        .gte("end_time", activeJobCutoff)
        .in("job_type", ["single", "festival", "ciclo", "tourdate"])
        .or("status.is.null,status.in.(Tentativa,Confirmado)")
        .order("start_time", { ascending: true });

      if (error) throw error;

      const rows = [...((activeJobs || []) as unknown as JobSelectionRow[])];

      // A deep link or embedded job card is authoritative. Always include that
      // job even if it is historical, completed, evento/dryhire, or otherwise
      // outside the browse selector's active-job filters.
      if (includeJobId && !rows.some((job) => job.id === includeJobId)) {
        const { data: includedJob, error: includedError } = await supabase
          .from("jobs")
          .select(JOB_SELECTION_COLUMNS)
          .eq("id", includeJobId)
          .maybeSingle();

        if (includedError) throw includedError;
        if (includedJob) rows.unshift(includedJob as unknown as JobSelectionRow);
      }

      return rows.map(mapJob);
    },
  });
