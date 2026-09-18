import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/react-query";
import { formatPowerRequirementsText } from "@/utils/powerRequirementSelection";

export const jobPowerRequirementsTextQueryKey = (jobId: string) =>
  queryKeys.scope("hoja-de-ruta-power-summary", jobId);

/**
 * The power summary the Consumos calculator would produce for this job right
 * now. The Hoja stores its own copy so manual edits survive, so this is what
 * the form compares against to tell the user their copy has fallen behind.
 */
export const useJobPowerRequirementsText = (jobId?: string | null) =>
  useQuery({
    queryKey: jobPowerRequirementsTextQueryKey(jobId ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("power_requirement_tables")
        .select("*")
        .eq("job_id", jobId ?? "")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return formatPowerRequirementsText(data ?? []);
    },
    enabled: Boolean(jobId),
  });
