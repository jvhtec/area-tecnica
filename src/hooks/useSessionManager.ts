
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionRefresh } from "./session/useSessionRefresh";
import { useProfileData } from "./session/useProfileData";
import { useProfileChanges } from "./session/useProfileChanges";
import { useAuthSession } from "./auth/useAuthSession";

export const useSessionManager = () => {
  const navigate = useNavigate();
  const { session, user, isLoading: sessionLoading } = useAuthSession();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [idleTime, setIdleTime] = useState(0);

  const { refreshSession } = useSessionRefresh();
  const { fetchUserProfile } = useProfileData();

  // Update loading state based on session loading
  useEffect(() => {
    setIsLoading(sessionLoading);
  }, [sessionLoading]);

  const handleSessionUpdate = useCallback(async (currentSession: any) => {
    setIdleTime(0);
    console.log("Session update handler called with session:", !!currentSession);

    if (!currentSession?.user?.id) {
      console.log("No valid session or user ID, clearing user data");
      setUserRole(null);
      setUserDepartment(null);
      setIsLoading(false);
      navigate("/auth");
      return;
    }

    console.log("Session found, updating user data for ID:", currentSession.user.id);
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

  // Handle session changes from centralized auth
  useEffect(() => {
    if (session) {
      handleSessionUpdate(session);
    } else if (!sessionLoading) {
      // Only clear if we're not loading
      setUserRole(null);
      setUserDepartment(null);
      navigate("/auth");
    }
  }, [session, sessionLoading, handleSessionUpdate]);

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

  // Add setSession function for Layout compatibility
  const setSession = useCallback(() => {
    // This is a placeholder - the session is managed by useAuthSession
    console.log("setSession called - session is managed by centralized auth");
  }, []);

  return {
    session,
    userRole,
    userDepartment,
    isLoading,
    setUserRole,
    setUserDepartment,
    setSession // Add this for Layout compatibility
  };
};
