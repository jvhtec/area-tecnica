
import { useCallback, useEffect, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Session } from "@supabase/supabase-js";

// Define types for user profile and session state
export interface UserProfile {
  id: string;
  role: string | null;
  department: string | null;
  // Add other profile fields as needed
}

interface SessionState {
  session: Session | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  idleTime: number;
}

// Define action types for the reducer
type SessionAction =
  | { type: 'SET_SESSION'; payload: Session | null }
  | { type: 'SET_USER_PROFILE'; payload: UserProfile | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'INCREMENT_IDLE_TIME' }
  | { type: 'RESET_IDLE_TIME' };

// Create reducer for atomic state updates
const sessionReducer = (state: SessionState, action: SessionAction): SessionState => {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'SET_USER_PROFILE':
      return { ...state, userProfile: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'INCREMENT_IDLE_TIME':
      return { ...state, idleTime: state.idleTime + 1 };
    case 'RESET_IDLE_TIME':
      return { ...state, idleTime: 0 };
    default:
      return state;
  }
};

// Unified session management hook
export const useAuthSession = () => {
  const navigate = useNavigate();
  
  // Use reducer for atomic state updates
  const [state, dispatch] = useReducer(sessionReducer, {
    session: null,
    userProfile: null,
    isLoading: true,
    idleTime: 0
  });

  // Fetch user profile with proper error handling
  const fetchUserProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error("Exception in fetchUserProfile:", error);
      return null;
    }
  }, []);

  // Consolidated refresh logic with proper error handling
  const refreshSession = useCallback(async () => {
    try {
      dispatch({ type: 'RESET_IDLE_TIME' });
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("Session refresh error:", error);
        // Handle expired session
        if (error.message.includes('expired')) {
          dispatch({ type: 'SET_SESSION', payload: null });
          dispatch({ type: 'SET_USER_PROFILE', payload: null });
          navigate('/auth');
        }
        return;
      }
      
      if (data.session) {
        dispatch({ type: 'SET_SESSION', payload: data.session });
        
        // Only fetch profile if we don't have it or if user ID changed
        if (!state.userProfile || state.userProfile.id !== data.session.user.id) {
          const profile = await fetchUserProfile(data.session.user.id);
          dispatch({ type: 'SET_USER_PROFILE', payload: profile });
        }
      }
    } catch (error) {
      console.error("Exception in refreshSession:", error);
    }
  }, [fetchUserProfile, navigate, state.userProfile]);

  // Handle session updates
  const handleSessionUpdate = useCallback(async (currentSession: Session | null) => {
    dispatch({ type: 'RESET_IDLE_TIME' });
    
    if (!currentSession?.user?.id) {
      dispatch({ type: 'SET_SESSION', payload: null });
      dispatch({ type: 'SET_USER_PROFILE', payload: null });
      dispatch({ type: 'SET_LOADING', payload: false });
      navigate('/auth');
      return;
    }
    
    // Set session first
    dispatch({ type: 'SET_SESSION', payload: currentSession });
    dispatch({ type: 'SET_LOADING', payload: false });
    
    try {
      const profileData = await fetchUserProfile(currentSession.user.id);
      dispatch({ type: 'SET_USER_PROFILE', payload: profileData });
    } catch (error) {
      console.error("Error in session update:", error);
      dispatch({ type: 'SET_USER_PROFILE', payload: null });
    }
  }, [fetchUserProfile, navigate]);

  // Idle time tracking
  useEffect(() => {
    const idleInterval = setInterval(() => {
      dispatch({ type: 'INCREMENT_IDLE_TIME' });
    }, 60000); // Increment idle time every minute
    
    return () => clearInterval(idleInterval);
  }, []);

  // Refresh session when idle for too long
  useEffect(() => {
    if (state.idleTime >= 15) { // 15 minutes of idle time
      refreshSession();
    }
  }, [state.idleTime, refreshSession]);

  // Token expiration prediction and refresh
  useEffect(() => {
    if (!state.session) return;
    
    // Calculate time until token expiration (default to 4 minutes if can't determine)
    const expiresAt = state.session.expires_at ? state.session.expires_at * 1000 : Date.now() + 4 * 60 * 1000;
    const timeUntilExpiry = expiresAt - Date.now();
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 60 * 1000); // Refresh 5 minutes before expiry or at least 1 minute
    
    const refreshTimer = setTimeout(() => {
      refreshSession();
    }, refreshTime);
    
    return () => clearTimeout(refreshTimer);
  }, [state.session, refreshSession]);

  // Initial session setup and auth state subscription
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    
    const setupSession = async () => {
      try {
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        
        // Handle initial session first
        await handleSessionUpdate(initialSession);
        
        // Then set up the subscription
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          async (_event, authStateSession) => {
            await handleSessionUpdate(authStateSession);
          }
        );
        
        subscription = authSubscription;
      } catch (error) {
        console.error("Error in session setup:", error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };
    
    setupSession();
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [handleSessionUpdate]);

  // User activity listeners to reset idle time
  useEffect(() => {
    const resetIdleTime = () => {
      dispatch({ type: 'RESET_IDLE_TIME' });
    };
    
    // Add event listeners for user activity
    window.addEventListener('mousemove', resetIdleTime);
    window.addEventListener('keydown', resetIdleTime);
    window.addEventListener('click', resetIdleTime);
    window.addEventListener('touchstart', resetIdleTime);
    
    return () => {
      window.removeEventListener('mousemove', resetIdleTime);
      window.removeEventListener('keydown', resetIdleTime);
      window.removeEventListener('click', resetIdleTime);
      window.removeEventListener('touchstart', resetIdleTime);
    };
  }, []);

  // Return consolidated session management interface
  return {
    session: state.session,
    userProfile: state.userProfile,
    isLoading: state.isLoading,
    refreshSession,
    
    // Derived properties for backward compatibility
    userRole: state.userProfile?.role || null,
    userDepartment: state.userProfile?.department || null,
  };
};
