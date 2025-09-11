import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { TokenManager } from "@/lib/token-manager";
import { useSubscriptionContext } from "@/providers/SubscriptionProvider";
import { getDashboardPath } from "@/utils/roleBasedRouting";

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
  const tokenManager = TokenManager.getInstance();

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

  const getSessionOnce = useCallback(async () => {
    if (isInitialized) return session;
    
    try {
      const currentSession = await tokenManager.getCachedSession();
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      
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

  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      console.log("Starting session refresh");
      
      const { session: refreshedSession, error } = await tokenManager.refreshToken();
      
      if (error) {
        console.error("Session refresh error:", error);
        
        if (error.message && (error.message.includes('expired') || error.message.includes('invalid'))) {
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
        
        if (!user || user.id !== refreshedSession.user.id) {
          const profile = await fetchUserProfile(refreshedSession.user.id);
          if (profile) {
            setUserRole(profile.role);
            setUserDepartment(profile.department);
          }
        }
        
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

  useEffect(() => {
    if (!isInitialized) {
      getSessionOnce();
    }
  }, [getSessionOnce, isInitialized]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log("Auth state changed:", event);
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
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

  // Token Manager handles all refresh timing - no competing timers needed here

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
        let roleForNavigation = null;
        
        if (profile) {
          setUserRole(profile.role);
          setUserDepartment(profile.department);
          roleForNavigation = profile.role;
        }
        
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        
        const dashboardPath = getDashboardPath(roleForNavigation);
        navigate(dashboardPath);
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
        // Wait a moment for the profile to be created by the trigger
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const profile = await fetchUserProfile(data.user.id);
        let roleForNavigation = null;
        
        if (profile) {
          setUserRole(profile.role);
          setUserDepartment(profile.department);
          roleForNavigation = profile.role;
        }
        
        toast({
          title: "Welcome!",
          description: "Your account has been created successfully.",
        });
        
        const dashboardPath = getDashboardPath(roleForNavigation);
        navigate(dashboardPath);
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

  const logout = async () => {
    try {
      setIsLoading(true);
      
      await tokenManager.signOut();
      
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
      navigate('/auth');
    } finally {
      setIsLoading(false);
    }
  };

  // Token Manager handles refresh scheduling automatically

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
    clearCache: tokenManager.clearCache.bind(tokenManager),
    getCacheStatus: tokenManager.getCacheStatus.bind(tokenManager)
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
