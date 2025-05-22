
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { useToast } from './use-toast';
import { useNavigate } from 'react-router-dom';
import { TokenManager } from '@/lib/token-manager';

// Define the context type
interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  userRole: string | null;
  userDepartment: string | null;
  logout: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  userRole: null,
  userDepartment: null,
  logout: async () => {},
  refreshSession: async () => null,
});

// Provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const tokenManager = TokenManager.getInstance();

  // Fetch the user's profile data
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, department')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      if (data) {
        setUserRole(data.role);
        setUserDepartment(data.department);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
    }
  }, []);

  // Refresh the user session
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      const { session, error } = await tokenManager.refreshToken();
      
      if (error) {
        console.error('Session refresh error:', error);
        setError(error.message);
        return null;
      }
      
      if (session) {
        setSession(session);
        setUser(session.user);
        return session;
      }
      
      return null;
    } catch (error) {
      console.error('Unexpected error in refreshSession:', error);
      return null;
    }
  }, [tokenManager]);

  // Log out the user
  const logout = useCallback(async () => {
    try {
      const { error } = await tokenManager.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        setError(error.message);
        return;
      }
      
      setUser(null);
      setSession(null);
      setUserRole(null);
      setUserDepartment(null);
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Unexpected error in logout:', error);
    }
  }, [navigate, tokenManager]);

  // Set up auth state listener and check initial session
  useEffect(() => {
    setIsLoading(true);
    
    // First set up the auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        console.log('Auth state change:', event);
        
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        // If user is logged in, fetch their profile
        if (currentSession?.user) {
          // Use setTimeout to avoid potential circular issues
          setTimeout(() => {
            fetchUserProfile(currentSession.user.id);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          // Clear user data on sign out
          setUserRole(null);
          setUserDepartment(null);
        }
      }
    );

    // Then check for existing session
    const getInitialSession = async () => {
      try {
        const currentSession = await tokenManager.getSession();
        setSession(currentSession);
        setUser(currentSession?.user || null);
        
        if (currentSession?.user) {
          await fetchUserProfile(currentSession.user.id);
        }
      } catch (err) {
        console.error('Error checking session:', err);
        setError('Failed to get user session');
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  // Value for the context provider
  const contextValue: AuthContextType = {
    user,
    session,
    isLoading,
    error,
    userRole,
    userDepartment,
    logout,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};
