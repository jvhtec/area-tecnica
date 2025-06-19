
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EquipmentModel {
  id: string;
  name: string;
  category: string;
}

export const useEquipmentModels = (category?: string) => {
  return useQuery({
    queryKey: ["equipment-models", category],
    queryFn: async () => {
      let query = supabase
        .from("equipment_models")
        .select("*")
        .order("name", { ascending: true });
      
      if (category) {
        query = query.eq("category", category);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as EquipmentModel[];
    }
  });
};
