
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export const useProfileChanges = (
  session: any,
  userRole: string | null,
  fetchUserProfile: (userId: string) => Promise<any>,
  setUserRole: (role: string | null) => void,
  setUserDepartment: (department: string | null) => void
) => {
  useEffect(() => {
    if (!session?.user?.id) return;

    console.log("Setting up profile changes subscription...");
    
    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`
        },
        async (payload) => {
          console.log("Profile changed:", payload);
          
          // Fetch the updated profile
          const profile = await fetchUserProfile(session.user.id);
          
          if (profile) {
            if (profile.role !== userRole) {
              console.log(`User role changed from ${userRole} to ${profile.role}`);
              setUserRole(profile.role);
            }
            
            setUserDepartment(profile.department);
          }
        }
      )
      .subscribe();
      
    console.log("Profile changes subscription established");

    return () => {
      console.log("Cleaning up profile changes subscription");
      supabase.removeChannel(channel);
    };
  }, [session, userRole, fetchUserProfile, setUserRole, setUserDepartment]);
};
