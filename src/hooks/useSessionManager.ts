
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { SessionManager, SessionStatus } from "@/lib/session-manager";
import { supabase } from "@/lib/supabase";

/**
 * React hook to interact with the SessionManager
 */
export const useSessionManager = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>("inactive");
  const [isInitialized, setIsInitialized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);

  // Set up the session manager on mount
  useEffect(() => {
    const sessionManager = SessionManager.getInstance();
    
    // Initialize if not already initialized
    if (!isInitialized) {
      sessionManager.initialize().then(() => {
        setIsInitialized(true);
        setSession(sessionManager.getSession());
        setStatus(sessionManager.getStatus());
        
        // Fetch user profile data if we have a session
        if (sessionManager.getSession()?.user) {
          fetchUserProfile(sessionManager.getSession()?.user.id);
        }
      });
    }

    // Set up event listeners
    const statusUnsubscribe = sessionManager.on("status-change", (newStatus) => {
      setStatus(newStatus);
    });

    const sessionUnsubscribe = sessionManager.on("session-refreshed", (newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        fetchUserProfile(newSession.user.id);
      }
    });

    const expiredUnsubscribe = sessionManager.on("session-expired", () => {
      setSession(null);
      setUserRole(null);
      setUserDepartment(null);
    });

    const signOutUnsubscribe = sessionManager.on("user-signed-out", () => {
      setSession(null);
      setUserRole(null);
      setUserDepartment(null);
    });

    // Clean up event listeners on unmount
    return () => {
      statusUnsubscribe();
      sessionUnsubscribe();
      expiredUnsubscribe();
      signOutUnsubscribe();
    };
  }, [isInitialized]);

  // Fetch user profile data
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, department')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error("Error fetching user profile:", error);
        return;
      }
      
      if (data) {
        setUserRole(data.role);
        setUserDepartment(data.department);
      }
    } catch (error) {
      console.error("Exception fetching user profile:", error);
    }
  };

  // Public methods
  const refreshSession = async () => {
    const sessionManager = SessionManager.getInstance();
    return sessionManager.refreshSession();
  };

  const signOut = async () => {
    const sessionManager = SessionManager.getInstance();
    return sessionManager.signOut();
  };

  const validateSession = async () => {
    const sessionManager = SessionManager.getInstance();
    return sessionManager.validateAndRefreshSession();
  };

  return {
    session,
    status,
    isInitialized,
    isAuthenticated: !!session,
    isLoading: status === "refreshing" || status === "recovering",
    isError: status === "error",
    userRole,
    userDepartment,
    setSession,
    setUserRole,
    setUserDepartment,
    refreshSession,
    signOut,
    validateSession,
  };
};
