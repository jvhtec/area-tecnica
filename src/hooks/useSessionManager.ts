
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { SessionManager, SessionStatus } from "@/lib/session-manager";

/**
 * React hook to interact with the SessionManager
 */
export const useSessionManager = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>("inactive");
  const [isInitialized, setIsInitialized] = useState(false);

  // Set up the session manager on mount
  useEffect(() => {
    const sessionManager = SessionManager.getInstance();
    
    // Initialize if not already initialized
    if (!isInitialized) {
      sessionManager.initialize().then(() => {
        setIsInitialized(true);
        setSession(sessionManager.getSession());
        setStatus(sessionManager.getStatus());
      });
    }

    // Set up event listeners
    const statusUnsubscribe = sessionManager.on("status-change", (newStatus) => {
      setStatus(newStatus);
    });

    const sessionUnsubscribe = sessionManager.on("session-refreshed", (newSession) => {
      setSession(newSession);
    });

    const expiredUnsubscribe = sessionManager.on("session-expired", () => {
      setSession(null);
    });

    const signOutUnsubscribe = sessionManager.on("user-signed-out", () => {
      setSession(null);
    });

    // Clean up event listeners on unmount
    return () => {
      statusUnsubscribe();
      sessionUnsubscribe();
      expiredUnsubscribe();
      signOutUnsubscribe();
    };
  }, [isInitialized]);

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
    refreshSession,
    signOut,
    validateSession,
  };
};
