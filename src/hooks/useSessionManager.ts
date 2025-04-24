import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSessionRefresh } from "./session/useSessionRefresh";
import { useProfileData } from "./session/useProfileData";
import { useProfileChanges } from "./session/useProfileChanges";

export const useSessionManager = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [idleTime, setIdleTime] = useState(0);

  const { refreshSession } = useSessionRefresh();
  const { fetchUserProfile } = useProfileData();

  const handleSessionUpdate = useCallback(async (currentSession: any) => {
    setIdleTime(0);
    console.log("Session update handler called with session:", !!currentSession);

    if (!currentSession?.user?.id) {
      console.log("No valid session or user ID, clearing user data");
      setSession(null);
      setUserRole(null);
      setUserDepartment(null);
      setIsLoading(false);
      navigate("/auth");
      return;
    }

    console.log("Session found, updating user data for ID:", currentSession.user.id);
    
    setSession(currentSession);
    setIsLoading(false);

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

  useEffect(() => {
    const idleInterval = setInterval(() => {
      setIdleTime((prevIdleTime) => prevIdleTime + 1);
    }, 60000);

    return () => clearInterval(idleInterval);
  }, []);

  useEffect(() => {
    if (idleTime >= 15) {
      refreshSession();
      setIdleTime(0);
    }
  }, [idleTime, refreshSession]);

  useEffect(() => {
    console.log("Setting up session...");
    let subscription: { unsubscribe: () => void } | null = null;

    const setupSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log("Initial session check:", !!initialSession);
        
        await handleSessionUpdate(initialSession);
        
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

  useEffect(() => {
    const interval = setInterval(async () => {
      if (session?.user?.id) {
        console.log("Periodic session refresh");
        await refreshSession();
      }
    }, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshSession, session]);

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
