import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSessionRefresh } from "./session/useSessionRefresh";
import { useProfileData } from "./session/useProfileData";
import { useProfileChanges } from "./session/useProfileChanges";

// Define proper types
interface UserProfile {
  role: string | null;
  department: string | null;
  [key: string]: any; // For other potential profile fields
}

export const useSessionManager = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [idleTime, setIdleTime] = useState(0);
  
  // Use refs to track subscription and mounted state
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  const mountedRef = useRef(true);
  const lastActiveRef = useRef(Date.now());
  const refreshAttemptCountRef = useRef(0);
  
  const { refreshSession } = useSessionRefresh();
  const { fetchUserProfile } = useProfileData();
  
  // Reset idle time on user activity
  const resetIdleTime = useCallback(() => {
    setIdleTime(0);
    lastActiveRef.current = Date.now();
  }, []);

  // Enhanced session update handler with error handling and retry logic
  const handleSessionUpdate = useCallback(async (currentSession: any) => {
    resetIdleTime();
    console.log("Session update handler called with session:", !!currentSession);

    if (!currentSession?.user?.id) {
      console.log("No valid session or user ID, clearing user data");
      setSession(null);
      setUserRole(null);
      setUserDepartment(null);
      setIsLoading(false);
      
      // Only navigate to auth if we're not already there
      if (!location.pathname.includes('/auth')) {
        navigate("/auth", { replace: true });
      }
      return;
    }

    console.log("Session found, updating user data for ID:", currentSession.user.id);
    setSession(currentSession);

    try {
      const profileData = await fetchUserProfile(currentSession.user.id);

      if (profileData && mountedRef.current) {
        setUserRole(profileData.role);
        setUserDepartment(profileData.department);
        refreshAttemptCountRef.current = 0; // Reset counter on success
      } else {
        console.log("No profile data found for user");
        if (mountedRef.current) {
          setUserRole(null);
          setUserDepartment(null);
        }
      }
    } catch (error) {
      console.error("Error in session update:", error);
      if (mountedRef.current) {
        setUserRole(null);
        setUserDepartment(null);
        
        // Retry logic for critical failures
        if (refreshAttemptCountRef.current < 3) {
          console.log(`Retrying profile fetch (attempt ${refreshAttemptCountRef.current + 1})`);
          refreshAttemptCountRef.current += 1;
          setTimeout(() => handleSessionUpdate(currentSession), 1000);
          return;
        }
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [fetchUserProfile, navigate, location.pathname, resetIdleTime]);

  // Track user activity
  useEffect(() => {
    const trackActivity = () => resetIdleTime();
    
    // Add multiple event listeners for better activity tracking
    window.addEventListener('mousedown', trackActivity);
    window.addEventListener('keydown', trackActivity);
    window.addEventListener('touchstart', trackActivity);
    window.addEventListener('scroll', trackActivity);
    
    // Check for idle time every minute
    const idleInterval = setInterval(() => {
      const now = Date.now();
      const minutesIdle = Math.floor((now - lastActiveRef.current) / 60000);
      setIdleTime(minutesIdle);
    }, 60000);

    return () => {
      window.removeEventListener('mousedown', trackActivity);
      window.removeEventListener('keydown', trackActivity);
      window.removeEventListener('touchstart', trackActivity);
      window.removeEventListener('scroll', trackActivity);
      clearInterval(idleInterval);
    };
  }, [resetIdleTime]);

  // Handle idle timeout and session refresh
  useEffect(() => {
    if (idleTime >= 14) { // Refresh slightly before timeout (assuming 15 min timeout)
      console.log(`User idle for ${idleTime} minutes, refreshing session`);
      refreshSession();
      resetIdleTime();
    }
  }, [idleTime, refreshSession, resetIdleTime]);

  // Initial session setup and auth state subscription
  useEffect(() => {
    console.log("Setting up session...");
    setIsLoading(true);
    
    const setupSession = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        console.log("Initial session check:", !!initialSession);
        
        if (mountedRef.current) {
          await handleSessionUpdate(initialSession);
        }
        
        // Set up auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, changedSession) => {
            console.log("Auth state changed:", _event);
            if (mountedRef.current) {
              await handleSessionUpdate(changedSession);
            }
          }
        );
        
        // Store subscription in ref for cleanup
        subscriptionRef.current = subscription;
      } catch (error) {
        console.error("Error in session setup:", error);
        if (mountedRef.current) {
          setIsLoading(false);
          setSession(null);
          
          if (!location.pathname.includes('/auth')) {
            navigate("/auth", { replace: true });
          }
        }
      }
    };
    
    setupSession();
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [handleSessionUpdate, navigate, location.pathname]);

  // Proactive session refresh with exponential backoff
  useEffect(() => {
    let refreshInterval = 4 * 60 * 1000; // Start with 4 minutes
    let timeoutId: NodeJS.Timeout;
    
    const scheduleRefresh = () => {
      timeoutId = setTimeout(async () => {
        if (!session) {
          scheduleRefresh();
          return;
        }
        
        console.log(`Proactively refreshing session (interval: ${refreshInterval/60000} min)`);
        try {
          const refreshed = await refreshSession();
          
          if (refreshed) {
            // Success - reset to normal interval
            refreshInterval = 4 * 60 * 1000;
          } else {
            // Failure - increase interval with cap
            refreshInterval = Math.min(refreshInterval * 1.5, 15 * 60 * 1000);
            
            // Redirect if we've completely lost the session
            if (!session) {
              navigate("/auth", { replace: true });
              return;
            }
          }
        } catch (err) {
          console.error("Error during scheduled refresh:", err);
          // Increase interval on error
          refreshInterval = Math.min(refreshInterval * 1.5, 15 * 60 * 1000);
        }
        
        // Schedule next refresh
        scheduleRefresh();
      }, refreshInterval);
    };
    
    // Start the refresh cycle
    scheduleRefresh();
    
    return () => clearTimeout(timeoutId);
  }, [refreshSession, navigate, session]);

  // Handle profile changes
  useProfileChanges(
    session,
    userRole,
    fetchUserProfile,
    setUserRole,
    setUserDepartment
  );

  return {
    session,
    userRole,
    userDepartment,
    isLoading,
    refreshSession, // Expose refresh function directly
    resetIdleTime,  // Expose ability to manually reset idle time
    setSession,
    setUserRole,
    setUserDepartment
  };
};