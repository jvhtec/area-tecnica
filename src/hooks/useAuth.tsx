
import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { TokenManager } from "@/lib/token-manager";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";

interface AuthContextType {
  session: Session | null;
  user: any | null;
  userRole: string | null;
  userDepartment: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (userData: SignUpData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
  setUserRole: (role: string | null) => void;
  setUserDepartment: (department: string | null) => void;
  // Expose cache utilities for debugging/monitoring
  clearCache: () => void;
  getCacheStatus: () => { hasCache: boolean; cacheAge: number; isValid: boolean };
}

interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  department?: string;
  dni?: string;
  residencia?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshSubscriptions, invalidateQueries } = useSubscriptionContext();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idleTime, setIdleTime] = useState(0);
  const tokenManager = TokenManager.getInstance();

  // Fetch user profile with proper error handling
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, department')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error("Exception in fetchUserProfile:", error);
      return null;
    }
  }, []);

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
        const profileData = await fetchUserProfile(currentSession.user.id);
        if (profileData) {
          setUserRole(profileData.role);
          setUserDepartment(profileData.department);
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
  }, [session, isInitialized, tokenManager, fetchUserProfile]);

  // Advanced and safe session refresh with proper error handling
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      console.log("Starting session refresh");
      setIdleTime(0);
      
      // Use the token manager to handle refresh
      const { session: refreshedSession, error } = await tokenManager.refreshToken();
      
      if (error) {
        console.error("Session refresh error:", error);
        
        // Handle expired session
        if (error.message && error.message.includes('expired')) {
          setSession(null);
          setUser(null);
          setUserRole(null);
          setUserDepartment(null);
          navigate('/auth');
          toast({
            title: "Session expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          });
        }
        return null;
      }
      
      if (refreshedSession) {
        console.log("Session refreshed successfully");
        setSession(refreshedSession);
        setUser(refreshedSession.user);
        
        // Only fetch profile if user changed
        if (!user || user.id !== refreshedSession.user.id) {
          const profile = await fetchUserProfile(refreshedSession.user.id);
          if (profile) {
            setUserRole(profile.role);
            setUserDepartment(profile.department);
          }
        }
        
        // Refresh subscriptions and invalidate queries for fresh data
        refreshSubscriptions();
        invalidateQueries();
        
        return refreshedSession;
      }
      
      console.log("No session returned from refresh");
      return null;
    } catch (error) {
      console.error("Exception in refreshSession:", error);
      return null;
    }
  }, [fetchUserProfile, navigate, user, tokenManager, toast, refreshSubscriptions, invalidateQueries]);

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
          fetchUserProfile(newSession.user.id).then((profileData) => {
            if (profileData) {
              setUserRole(profileData.role);
              setUserDepartment(profileData.department);
            }
          });
        } else {
          setUserRole(null);
          setUserDepartment(null);
        }
        
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  // Idle time management
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

  // Periodic session refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      if (session?.user?.id) {
        console.log("Periodic session refresh");
        await refreshSession();
      }
    }, 4 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshSession, session]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (error) {
        setError(error.message);
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        const profile = await fetchUserProfile(data.user.id);
        if (profile) {
          setUserRole(profile.role);
          setUserDepartment(profile.department);
        }
        
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        
        navigate("/dashboard");
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sign Up function
  const signUp = async (userData: SignUpData) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.auth.signUp({
        email: userData.email.toLowerCase(),
        password: userData.password,
        options: {
          data: {
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: userData.phone,
            department: userData.department,
            dni: userData.dni,
            residencia: userData.residencia,
          },
        },
      });

      if (error) {
        setError(error.message);
        toast({
          title: "Signup failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        toast({
          title: "Welcome!",
          description: "Your account has been created successfully.",
        });
        
        navigate("/dashboard");
      }
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      
      await tokenManager.signOut();
      
      // Clear all state
      setSession(null);
      setUser(null);
      setUserRole(null);
      setUserDepartment(null);
      
      toast({
        title: "Success",
        description: "You have been logged out successfully",
      });
      
      navigate('/auth');
    } catch (error: any) {
      setError(error.message);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
      // Still navigate to auth page even if there's an error
      navigate('/auth');
    } finally {
      setIsLoading(false);
    }
  };

  // Setup predictive token refresh
  useEffect(() => {
    if (!session) return;
    
    // Calculate optimal refresh time
    const refreshTime = tokenManager.calculateRefreshTime(session);
    console.log(`Scheduling token refresh in ${Math.round(refreshTime/1000)} seconds`);
    
    const refreshTimer = setTimeout(() => {
      console.log("Executing scheduled token refresh");
      refreshSession();
    }, refreshTime);
    
    return () => clearTimeout(refreshTimer);
  }, [session, refreshSession, tokenManager]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      refreshSession();
      toast({
        title: "Connection restored",
        description: "You are back online",
        variant: "default",
      });
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only refresh if we have a session and it might be stale
        if (session && tokenManager.checkTokenExpiration(session, 10 * 60 * 1000)) {
          refreshSession();
        }
      }
    };
    
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshSession, session, toast, tokenManager]);

  const value = {
    session,
    user,
    userRole,
    userDepartment,
    isLoading,
    isInitialized,
    error,
    login,
    signUp,
    logout,
    refreshSession,
    setUserRole,
    setUserDepartment,
    getSessionOnce,
    // Expose cache utilities for debugging/monitoring
    clearCache: tokenManager.clearCache.bind(tokenManager),
    getCacheStatus: tokenManager.getCacheStatus.bind(tokenManager)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
