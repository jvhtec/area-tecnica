
import { useState, useEffect, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { TokenManager } from "@/lib/token-manager";

/**
 * Centralized session management hook with caching
 * Replaces multiple getSession() calls with a single cached source of truth
 */
export const useAuthSession = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  const tokenManager = TokenManager.getInstance();

  // Memoized session getter to prevent redundant calls using cache
  const getSessionOnce = useCallback(async () => {
    if (isInitialized) return session;
    
    try {
      // Use cached session from TokenManager
      const currentSession = await tokenManager.getCachedSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
      // Fetch user role if session exists
      if (currentSession?.user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentSession.user.id)
          .maybeSingle();
        
        if (profileData) {
          setUserRole(profileData.role);
        }
      }
      
      setIsInitialized(true);
      return currentSession;
    } catch (error) {
      console.error("Error getting session:", error);
      setIsInitialized(true);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [session, isInitialized, tokenManager]);

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
        
        // Fetch user role for new session
        if (newSession?.user?.id) {
          supabase
            .from('profiles')
            .select('role')
            .eq('id', newSession.user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                setUserRole(data.role);
              }
            });
        } else {
          setUserRole(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    session,
    user,
    userRole,
    isLoading,
    isInitialized,
    getSessionOnce,
    // Expose cache utilities for debugging/monitoring
    clearCache: tokenManager.clearCache.bind(tokenManager),
    getCacheStatus: tokenManager.getCacheStatus.bind(tokenManager)
  };
};
