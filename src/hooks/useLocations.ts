import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";


import { queryKeys } from "@/lib/react-query";
export const useLocations = () => {
  return useQuery({
    queryKey: queryKeys.scope("locations"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("name")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
};