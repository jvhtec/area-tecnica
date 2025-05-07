import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface UserProfile {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  department?: string;
  [key: string]: any;
}

// Create a global heartbeat to keep track of the last activity time
let lastActivityTimestamp = Date.now();
let globalSessionRefreshPromise: Promise<any> | null = null;

// Global heartbeat tracking function
const updateGlobalLastActivity = () => {
  lastActivityTimestamp = Date.now();
};

// Add activity listeners
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', updateGlobalLastActivity);
  window.addEventListener('keydown', updateGlobalLastActivity);
  window.addEventListener('click', updateGlobalLastActivity);
  window.addEventListener('touchstart', updateGlobalLastActivity);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      updateGlobalLastActivity();
    }
  });
}

/**
 * Enhanced session management hook with intelligent refresh strategies and resilience
 */
export function useUnifiedSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user profile from Supabase
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log(`Fetching profile data for user: ${userId}`);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      if (!data) {
        console.log("No profile found for user:", userId);
        return null;
      }

      console.log("Profile fetched successfully");
      return data as UserProfile;
    } catch (error) {
      console.error("Exception in fetchUserProfile:", error);
      return null;
    }
  }, []);

  // Refresh session with optimized handling and a global lock to prevent multiple calls
  const refreshSession = useCallback(async (force = false) => {
    console.log("Session refresh requested", force ? "(forced)" : "");
    const now = Date.now();
    
    // Skip if refresh is already in progress
    if (globalSessionRefreshPromise !== null) {
      console.log("Session refresh already in progress, waiting for it to complete");
      try {
        await globalSessionRefreshPromise;
        return;
      } catch {
        // If the current refresh fails, allow a new one
        globalSessionRefreshPromise = null;
      }
    }
    
    // Skip if we refreshed recently unless forced
    if (!force && now - lastRefreshTime < 10000) { // 10 seconds
      console.log("Skipping refresh, last refresh was too recent");
      return;
    }

    try {
      setLastRefreshTime(now);
      updateGlobalLastActivity();
      
      const refreshPromise = supabase.auth.refreshSession();
      globalSessionRefreshPromise = refreshPromise;
      
      const { data, error } = await refreshPromise;
      
      if (error) {
        console.error("Session refresh error:", error);
        
        // Handle expired session
        if (error.message?.includes('expired') || error.status === 401) {
          // Clear the session and redirect to auth
          setSession(null);
          setUser(null);
          setUserProfile(null);
          navigate('/auth');
          toast.error('Session expired. Please log in again.');
        }
        return;
      }
      
      if (data.session) {
        console.log("Session refreshed successfully");
        setSession(data.session);
        setUser(data.session.user);
        
        // Only fetch profile if we don't have it or if user ID changed
        if (!userProfile || userProfile.id !== data.session.user.id) {
          const profile = await fetchUserProfile(data.session.user.id);
          setUserProfile(profile);
        }
        
        // Refresh any critical data
        queryClient.invalidateQueries({ queryKey: ['profiles'] });
      } else {
        console.log("No session found during refresh");
      }
    } catch (error) {
      console.error("Error in refreshSession:", error);
    } finally {
      globalSessionRefreshPromise = null;
    }
  }, [fetchUserProfile, lastRefreshTime, navigate, queryClient, userProfile]);

  // Handle session updates
  const handleSessionUpdate = useCallback(async (currentSession: Session | null) => {
    console.log("Auth state changed:", currentSession ? "Has session" : "No session");
    updateGlobalLastActivity();
    
    if (!currentSession) {
      setSession(null);
      setUser(null);
      setUserProfile(null);
      setIsLoading(false);
      
      // Only navigate to auth if we're not already there
      if (!window.location.pathname.includes('/auth')) {
        navigate('/auth');
      }
      return;
    }
    
    // Update session state
    setSession(currentSession);
    setUser(currentSession.user);
    setIsLoading(false);
    
    try {
      // Schedule profile fetch with setTimeout to avoid potential deadlock
      setTimeout(async () => {
        if (currentSession?.user?.id) {
          const profileData = await fetchUserProfile(currentSession.user.id);
          setUserProfile(profileData);
        }
      }, 0);
    } catch (error) {
      console.error("Error in session update:", error);
      setUserProfile(null);
    }
  }, [fetchUserProfile, navigate]);

  // Check for tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Tab became visible, scheduling session check");
        
        // Clear any existing timeout
        if (visibilityTimeoutRef.current) {
          clearTimeout(visibilityTimeoutRef.current);
        }
        
        // Schedule a refresh after a short delay
        visibilityTimeoutRef.current = setTimeout(() => {
          const timeSinceLastActivity = Date.now() - lastActivityTimestamp;
          
          // If we've been inactive for a while, force a refresh
          if (timeSinceLastActivity > 2 * 60 * 1000) { // 2 minutes
            console.log(`Tab was inactive for ${timeSinceLastActivity}ms, forcing refresh`);
            refreshSession(true);
            
            // Also invalidate critical data
            queryClient.invalidateQueries();
            
            toast.info("Refreshing data after inactivity", {
              description: "You've been away for a while"
            });
          } else {
            // Otherwise just do a regular refresh
            refreshSession(false);
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
      }
    };
  }, [queryClient, refreshSession]);

  // Set up token expiration prediction and smart refresh
  useEffect(() => {
    if (!session) return;
    
    // Clear any existing refresh timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    
    // Calculate time until token expiration
    const expiresAt = session.expires_at ? session.expires_at * 1000 : Date.now() + 3600 * 1000;
    const timeUntilExpiry = Math.max(0, expiresAt - Date.now());
    
    // Refresh 5 minutes before expiry or halfway to expiry for short-lived tokens
    const refreshTime = Math.min(
      timeUntilExpiry - Math.min(5 * 60 * 1000, timeUntilExpiry / 2),
      30 * 60 * 1000 // Maximum 30 minutes between refreshes
    );
    
    console.log(`Scheduling token refresh in ${Math.round(refreshTime/1000)} seconds`);
    
    // Set up refresh timeout
    refreshTimeoutRef.current = setTimeout(() => {
      console.log("Token refresh timer triggered");
      refreshSession(false);
    }, refreshTime);
    
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [session, refreshSession]);

  // Periodic session health check
  useEffect(() => {
    // Set up a periodic check (every 4 minutes) to ensure session is healthy
    sessionCheckIntervalRef.current = setInterval(() => {
      const timeSinceLastRefresh = Date.now() - lastRefreshTime;
      
      // If it's been more than 10 minutes since our last refresh, check the session
      if (timeSinceLastRefresh > 10 * 60 * 1000) {
        console.log("Periodic session health check");
        refreshSession(false);
      }
    }, 4 * 60 * 1000);
    
    return () => {
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [lastRefreshTime, refreshSession]);

  // Watch for idle time
  useEffect(() => {
    // Check idle time every minute
    idleTimeoutRef.current = setInterval(() => {
      const idleTime = Date.now() - lastActivityTimestamp;
      
      // If idle for more than 15 minutes, refresh the session
      if (idleTime > 15 * 60 * 1000 && session) {
        console.log(`User has been idle for ${Math.round(idleTime/60000)} minutes, refreshing session`);
        refreshSession(false);
      }
    }, 60 * 1000);
    
    return () => {
      if (idleTimeoutRef.current) {
        clearInterval(idleTimeoutRef.current);
      }
    };
  }, [refreshSession, session]);

  // Initialize session
  useEffect(() => {
    console.log("Initializing session...");
    setIsLoading(true);
    
    let subscription: { unsubscribe: () => void } | null = null;
    
    const setupSession = async () => {
      try {
        // Set up the auth state listener first
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          async (_event, authStateSession) => {
            await handleSessionUpdate(authStateSession);
          }
        );
        
        subscription = authSubscription;
        
        // Then check for an existing session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        await handleSessionUpdate(initialSession);
      } catch (error) {
        console.error("Error in session setup:", error);
        setIsLoading(false);
      }
    };
    
    setupSession();
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [handleSessionUpdate]);

  // Return unified session interface
  return {
    session,
    user,
    userProfile,
    isLoading,
    refreshSession,
    lastRefreshTime,
    
    // Derived props for backward compatibility
    userRole: userProfile?.role || null,
    userDepartment: userProfile?.department || null,
  };
}
