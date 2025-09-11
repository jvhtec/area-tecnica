import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import { safeQuery } from "@/lib/supabaseRetry";

interface UserPreferences {
  dark_mode: boolean;
  time_span: string;
  last_activity: string;
  custom_folder_structure: any;
  custom_tour_folder_structure: any;
}

export const useUserPreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const updatePreferences = async (newPreferences: Partial<UserPreferences>) => {
    try {
      console.log('Updating preferences:', newPreferences);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.log('No session found, cannot update preferences');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          ...newPreferences,
          last_activity: new Date().toISOString(),
        })
        .eq('id', session.user.id);

      if (error) {
        console.error('Error updating preferences:', error);
        // Don't throw on database errors during preference updates
        return;
      }

      setPreferences(prev => prev ? { ...prev, ...newPreferences } : null);
      console.log('Preferences updated successfully');
    } catch (error: any) {
      console.error('Error updating preferences:', error);
      // Check if it's a network error and fail silently
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        console.log('Network error detected, skipping preference update');
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive",
      });
    }
  };

  const checkInactivity = async () => {
    if (!preferences?.last_activity) return;
    
    const lastActivity = new Date(preferences.last_activity);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff >= 8) {
      console.log('Session expired due to inactivity');
      await supabase.auth.signOut();
      toast({
        title: "Session Expired",
        description: "You have been logged out due to inactivity",
      });
      window.location.href = '/auth';
    }
  };

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        console.log('Loading user preferences...');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) {
          console.log('No session found');
          return;
        }

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('dark_mode, time_span, last_activity, custom_folder_structure, custom_tour_folder_structure')
            .eq('id', session.user.id)
            .maybeSingle();

          if (error) {
            console.error('Error loading preferences:', error);
            // Don't throw on database errors, just log and continue
            return;
          }

          if (data) {
            console.log('Preferences loaded:', data);
            setPreferences(data);
            
            // Apply dark mode if saved
            if (data.dark_mode) {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
        } catch (error: any) {
          console.error('Error loading preferences:', error);
          // Check if it's a network error
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            console.log('Network error detected, skipping preferences load');
            return;
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();

    // Throttle activity updates to prevent spam - increased to 15 minutes
    let lastActivityUpdate = 0;
    const ACTIVITY_UPDATE_THROTTLE = 15 * 60 * 1000; // 15 minutes
    let isOnline = true;

    const trackActivity = () => {
      if (!isOnline) return; // Skip if offline
      
      const now = Date.now();
      if (now - lastActivityUpdate >= ACTIVITY_UPDATE_THROTTLE) {
        lastActivityUpdate = now;
        updatePreferences({ 
          last_activity: new Date().toISOString() 
        });
      }
    };

    // Monitor online/offline status
    const handleOnline = () => {
      isOnline = true;
      console.log('Network restored, resuming preference updates');
    };
    
    const handleOffline = () => {
      isOnline = false;
      console.log('Network offline, pausing preference updates');
    };

    // Check inactivity every minute
    const inactivityInterval = setInterval(checkInactivity, 60000);

    // Track meaningful user interactions instead of constant activity
    window.addEventListener('click', trackActivity);
    window.addEventListener('keydown', trackActivity);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(inactivityInterval);
      window.removeEventListener('click', trackActivity);
      window.removeEventListener('keydown', trackActivity);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    preferences,
    isLoading,
    updatePreferences,
  };
};