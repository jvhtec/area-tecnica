import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export const useProfileChanges = (
  session: any,
  userRole: string | null,
  fetchUserProfile: (userId: string) => Promise<any>,
  setUserRole: (role: string | null) => void,
  setUserDepartment: (department: string | null) => void
) => {
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        async (payload) => {
          console.log('Profile changed:', payload);
          try {
            const profileData = await fetchUserProfile(session.user.id);
            console.log('Updated profile data:', profileData);
            
            setUserRole(profileData.role);
            setUserDepartment(profileData.department);
            
            // Only force reload if we're not on the settings page
            const currentPath = window.location.pathname;
            if (currentPath !== '/settings' && profileData.role !== userRole) {
              const newPath = profileData.role === 'technician' ? '/technician-dashboard' : '/dashboard';
              window.location.href = newPath;
            }
          } catch (error) {
            console.error('Error updating profile data:', error);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, userRole, fetchUserProfile, setUserRole, setUserDepartment]);
};