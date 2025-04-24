
import { useCallback, useEffect, useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { TokenManager } from "@/lib/token-manager";

interface UserProfile {
  id: string;
  role: string | null;
  department: string | null;
}

interface SessionState {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

type SessionAction =
  | { type: 'SET_SESSION'; payload: Session | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_PROFILE'; payload: UserProfile | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: SessionState = {
  session: null,
  user: null,
  userProfile: null,
  isLoading: true,
  error: null
};

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_PROFILE':
      return { ...state, userProfile: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

export function useAuthSession() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [state, dispatch] = useReducer(sessionReducer, initialState);
  const tokenManager = TokenManager.getInstance();

  // Fetch user profile
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return null;
    }
  }, []);

  // Handle session updates
  const handleSessionUpdate = useCallback(async (currentSession: Session | null) => {
    console.log('Session update:', !!currentSession);
    
    dispatch({ type: 'SET_SESSION', payload: currentSession });
    dispatch({ type: 'SET_USER', payload: currentSession?.user ?? null });

    if (currentSession?.user) {
      const profile = await fetchUserProfile(currentSession.user.id);
      dispatch({ type: 'SET_PROFILE', payload: profile });
    } else {
      dispatch({ type: 'SET_PROFILE', payload: null });
    }
  }, [fetchUserProfile]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        dispatch({ type: 'SET_PROFILE', payload: profile });
        
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        
        navigate("/dashboard");
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Logout function
  const logout = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await tokenManager.signOut();
      
      dispatch({ type: 'SET_SESSION', payload: null });
      dispatch({ type: 'SET_USER', payload: null });
      dispatch({ type: 'SET_PROFILE', payload: null });
      
      toast({
        title: "Success",
        description: "You have been logged out successfully",
      });
      
      navigate('/auth');
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      navigate('/auth');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Setup session listener and initial session check
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    
    const setupSession = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        // Set up auth state listener FIRST
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            await handleSessionUpdate(session);
          }
        );
        
        subscription = authSubscription;
        
        // THEN check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        await handleSessionUpdate(session);
        
      } catch (error: any) {
        console.error('Error in session setup:', error);
        dispatch({ type: 'SET_ERROR', payload: error.message });
      } finally {
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

  // Setup profile changes subscription
  useEffect(() => {
    if (!state.user?.id) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${state.user.id}`
        },
        async () => {
          const profile = await fetchUserProfile(state.user.id!);
          dispatch({ type: 'SET_PROFILE', payload: profile });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.user?.id, fetchUserProfile]);

  return {
    session: state.session,
    user: state.user,
    userRole: state.userProfile?.role ?? null,
    userDepartment: state.userProfile?.department ?? null,
    isLoading: state.isLoading,
    error: state.error,
    login,
    logout,
  };
}
