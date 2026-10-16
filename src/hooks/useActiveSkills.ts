import { useQuery } from "@tanstack/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { queryKeys } from "@/lib/react-query";

export type ActiveSkill = { id: string; name: string; category: string | null };

/**
 * The active skill catalog. Lives under the settings catalog key
 * (`skill_catalog`), so creating or editing a skill there, or a realtime change
 * to `skills`, refreshes every consumer.
 */
export const ACTIVE_SKILLS_QUERY_KEY = queryKeys.scope("skill_catalog", "active");

export function useActiveSkills() {
  return useQuery({
    queryKey: ACTIVE_SKILLS_QUERY_KEY,
    queryFn: async (): Promise<ActiveSkill[]> => {
      const { data, error } = await dataLayerClient
        .from("skills")
        .select("id,name,category")
        .eq("active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((skill): skill is ActiveSkill => Boolean(skill?.name));
    },
    staleTime: 5 * 60 * 1000,
  });
}
