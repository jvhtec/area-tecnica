
import { useState, useEffect, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Centralized session management hook
 * Replaces multiple getSession() calls with a single source of truth
 */
export const useAuthSession = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Memoized session getter to prevent redundant calls
  const getSessionOnce = useCallback(async () => {
    if (isInitialized) return session;
    
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsInitialized(true);
      return currentSession;
    } catch (error) {
      console.error("Error getting session:", error);
      setIsInitialized(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session, isInitialized]);

  // Initialize session on mount
  useEffect(() => {
    if (!isInitialized) {
      getSessionOnce();
    }
  }, [getSessionOnce, isInitialized]);

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("Auth state changed:", event);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    user,
    isLoading,
    isInitialized,
    getSessionOnce
  };
};
