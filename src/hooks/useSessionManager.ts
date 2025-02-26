import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSessionRefresh } from "./session/useSessionRefresh";
import { useProfileData } from "./session/useProfileData";
import { useProfileChanges } from "./session/useProfileChanges";

// Keep the original structure but fix critical issues
export const useSessionManager = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [idleTime, setIdleTime] = useState(0);

  const { refreshSession } = useSessionRefresh();
  const { fetchUserProfile } = useProfileData();

  // IMPORTANT FIX: Make sure session state is stable
  const handleSessionUpdate = useCallback(async (currentSession: any) => {
    setIdleTime(0); // Reset idle time on session update
    console.log("Session update handler called with session:", !!currentSession);

    if (!currentSession?.user?.id) {
      console.log("No valid session or user ID, clearing user data");
      setSession(null);
      setUserRole(null);
      setUserDepartment(null);
      setIsLoading(false);
      navigate("/auth"); // Redirect to login if session is invalid
      return;
    }

    console.log("Session found, updating user data for ID:", currentSession.user.id);
    
    // CRITICAL FIX: Set session first and separately from the async profile fetch
    setSession(currentSession);
    setIsLoading(false); // Make sure we're not showing loading state during navigation

    try {
      const profileData = await fetchUserProfile(currentSession.user.id);

      if (profileData) {
        setUserRole(profileData.role);
        setUserDepartment(profileData.department);
      } else {
        console.log("No profile data found for user");
        setUserRole(null);
        setUserDepartment(null);
      }
    } catch (error) {
      console.error("Error in session update:", error);
      setUserRole(null);
      setUserDepartment(null);
    }
  }, [fetchUserProfile, navigate]);

  // Keep idle tracking simple
  useEffect(() => {
    const idleInterval = setInterval(() => {
      setIdleTime((prevIdleTime) => prevIdleTime + 1);
    }, 60000); // Increment idle time every minute

    return () => clearInterval(idleInterval);
  }, []);

  useEffect(() => {
    if (idleTime >= 15) { // 15 minutes of idle time
      refreshSession();
      setIdleTime(0); // Reset idle time after refresh
    }
  }, [idleTime, refreshSession]);

  // CRITICAL FIX: Ensure clean subscription management
  useEffect(() => {
    console.log("Setting up session...");
    let subscription: { unsubscribe: () => void } | null = null;

    const setupSession = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log("Initial session check:", !!initialSession);
        
        // Handle initial session first
        await handleSessionUpdate(initialSession);
        
        // Then set up the subscription
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          async (_event, authStateSession) => {
            console.log("Auth state changed:", _event);
            await handleSessionUpdate(authStateSession);
          }
        );
        
        subscription = authSubscription;
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

  // SIMPLIFIED: Use a single periodic refresh that's stable
  useEffect(() => {
    const interval = setInterval(async () => {
      if (session?.user?.id) {
        console.log("Periodic session refresh");
        await refreshSession();
      }
    }, 4 * 60 * 1000); // 4 minutes

    return () => clearInterval(interval);
  }, [refreshSession, session]);

  // Keep profile changes mechanism
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
    setSession,
    setUserRole,
    setUserDepartment
  };
};