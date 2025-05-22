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
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (userData: SignUpData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
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
  const [error, setError] = useState<string | null>(null);
  const tokenManager = TokenManager.getInstance();

  // Fetch user profile with proper error handling
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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

  // Advanced and safe session refresh with proper error handling
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    try {
      console.log("Starting session refresh");
      
      // Use the token manager to handle refresh
      const { session: refreshedSession, error } = await tokenManager.refreshToken();
      
      if (error) {
        console.log("Session refresh error:", error);
        
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

  // Initial session setup and auth state subscription
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    
    const setupSession = async () => {
      try {
        setIsLoading(true);
        
        // Get initial session
        const initialSession = await supabase.auth.getSession();
        
        if (initialSession.data.session) {
          setSession(initialSession.data.session);
          setUser(initialSession.data.session.user);
          
          const profile = await fetchUserProfile(initialSession.data.session.user.id);
          if (profile) {
            setUserRole(profile.role);
            setUserDepartment(profile.department);
          }
        }
        
        // Set up the auth state change listener
        const { data } = await supabase.auth.onAuthStateChange(
          async (event, authStateSession) => {
            console.log("Auth state changed:", event);
            
            if (authStateSession) {
              setSession(authStateSession);
              setUser(authStateSession.user);
              
              const profile = await fetchUserProfile(authStateSession.user.id);
              if (profile) {
                setUserRole(profile.role);
                setUserDepartment(profile.department);
              }
              
              // Refresh subscriptions for new user context
              refreshSubscriptions();
            } else {
              setSession(null);
              setUser(null);
              setUserRole(null);
              setUserDepartment(null);
              
              if (event === 'SIGNED_OUT') {
                navigate('/auth');
              }
            }
          }
        );
        
        subscription = data.subscription;
      } catch (error: any) {
        console.error("Error in session setup:", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    setupSession();
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [navigate, fetchUserProfile, tokenManager, refreshSubscriptions]);

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
        if (session) {
          tokenManager.checkTokenExpiration().then(isExpiring => {
            if (isExpiring) {
              refreshSession();
            }
          });
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
    error,
    login,
    signUp,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
