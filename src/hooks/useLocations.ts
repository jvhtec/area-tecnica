import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useLocations = () => {
  return useQuery({
    queryKey: ["locations"],
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