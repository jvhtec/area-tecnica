import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export const useProfileData = () => {
  const fetchUserProfile = useCallback(async (userId: string | undefined) => {
    console.log('Fetching user profile for:', userId);
    try {
      if (!userId) {
        console.error("No user ID provided to fetchUserProfile");
        return null;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, department')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error("Error fetching user profile:", profileError);
        throw profileError;
      }

      console.log('User profile fetched:', profileData);
      return profileData;
    } catch (error) {
      console.error("Error in fetchUserProfile:", error);
      throw error;
    }
  }, []);

  return { fetchUserProfile };
};