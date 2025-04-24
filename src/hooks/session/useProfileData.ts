
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";

export const useProfileData = () => {
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log("Fetching user profile for ID:", userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      console.log("User profile fetched successfully:", data);
      return data;
    } catch (error) {
      console.error("Exception in fetchUserProfile:", error);
      return null;
    }
  }, []);

  return { fetchUserProfile };
};
