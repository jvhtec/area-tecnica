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
  
  const { refreshSession } = useSessionRefresh();
  const { fetchUserProfile } = useProfileData();

  const handleSessionUpdate = useCallback(async (currentSession: any) => {
    console.log("Session update handler called with session:", !!currentSession);
    
    if (!currentSession?.user?.id) {
      console.log("No valid session or user ID, clearing user data");
      setSession(null);
      setUserRole(null);
      setUserDepartment(null);
      setIsLoading(false);
      return;
    }

    console.log("Session found, updating user data for ID:", currentSession.user.id);
    setSession(currentSession);
    
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
      // Don't clear session on profile fetch error
      setUserRole(null);
      setUserDepartment(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    let mounted = true;
    console.log("Setting up session...");

    const setupSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log("Initial session check:", !!initialSession);

        if (mounted) {
          await handleSessionUpdate(initialSession);
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, session) => {
          console.log("Auth state changed:", _event);
          if (mounted) {
            await handleSessionUpdate(session);
          }
        });

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error("Error in session setup:", error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    setupSession();
    
    return () => {
      mounted = false;
    };
  }, [handleSessionUpdate]);

  // Always call useProfileChanges, even if there's no session
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